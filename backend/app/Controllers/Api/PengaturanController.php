<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Models\PengaturanModel;
use CodeIgniter\API\ResponseTrait;

/**
 * Aturan presensi yang diatur admin: jadwal sesi dan hari libur
 */
class PengaturanController extends BaseController
{
    use ResponseTrait;

    protected $db;

    public function __construct()
    {
        $this->db = \Config\Database::connect();
    }

    // ----------------------------------------------------
    // GET /api/sesi
    // ----------------------------------------------------
    public function getSesi()
    {
        $data = $this->db->query("
            SELECT
                Id_sesi as id,
                Nama as nama,
                TIME_FORMAT(Jam_mulai, '%H:%i') as jamMulai,
                TIME_FORMAT(Jam_selesai, '%H:%i') as jamSelesai,
                Aktif as aktif,
                COALESCE(DATE(created_at), '') as berlakuSejak
            FROM sesi
            ORDER BY Jam_mulai ASC
        ")->getResultArray();

        foreach ($data as &$row) {
            $row['id']    = (int) $row['id'];
            $row['aktif'] = (bool) $row['aktif'];
        }
        return $this->respond($data);
    }

    // ----------------------------------------------------
    // POST /api/sesi
    // Menyimpan seluruh daftar sesi sekaligus (tambah / ubah)
    // ----------------------------------------------------
    public function saveSesi()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $list  = $input['sesi'] ?? [];

        if (! is_array($list) || $list === []) {
            return $this->fail('Daftar sesi wajib diisi.', 400);
        }

        $nama  = [];
        $aktif = [];
        foreach ($list as $s) {
            $n = trim($s['nama'] ?? '');
            if ($n === '' || empty($s['jamMulai']) || empty($s['jamSelesai'])) {
                return $this->fail('Nama dan jam setiap sesi wajib diisi.', 400);
            }
            if ($s['jamSelesai'] <= $s['jamMulai']) {
                return $this->fail('Jam selesai sesi ' . $n . ' harus setelah jam mulai.', 400);
            }
            if (in_array(strtolower($n), $nama, true)) {
                return $this->fail('Nama sesi tidak boleh sama.', 400);
            }
            $nama[] = strtolower($n);
            if (! empty($s['aktif'])) {
                $aktif[] = $s;
            }
        }
        usort($aktif, static fn ($a, $b) => strcmp($a['jamMulai'], $b['jamMulai']));
        for ($i = 1; $i < count($aktif); $i++) {
            if ($aktif[$i]['jamMulai'] <= $aktif[$i - 1]['jamSelesai']) {
                return $this->fail('Jam sesi aktif tidak boleh saling tumpang tindih.', 400);
            }
        }

        $this->db->transStart();
        foreach ($list as $s) {
            $row = [
                'Nama'        => trim($s['nama']),
                'Jam_mulai'   => $s['jamMulai'],
                'Jam_selesai' => $s['jamSelesai'],
                'Aktif'       => empty($s['aktif']) ? 0 : 1,
                'updated_at'  => date('Y-m-d H:i:s'),
            ];
            $id = (int) ($s['id'] ?? 0);
            if ($id && $this->db->table('sesi')->where('Id_sesi', $id)->countAllResults()) {
                $this->db->table('sesi')->where('Id_sesi', $id)->update($row);
            } else {
                $this->db->table('sesi')->insert($row + ['created_at' => date('Y-m-d H:i:s')]);
            }
        }
        $this->db->transComplete();

        return $this->respond(['status' => 'success', 'message' => 'Jadwal sesi berhasil disimpan']);
    }

    // ----------------------------------------------------
    // GET /api/mode-uji
    // ----------------------------------------------------
    public function getModeUji()
    {
        return $this->respond((new PengaturanModel())->modeUji());
    }

    // ----------------------------------------------------
    // POST /api/mode-uji
    // Pengecualian aturan presensi agar admin dapat mencoba fitur absensi
    // ----------------------------------------------------
    public function saveModeUji()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        (new PengaturanModel())->simpanModeUji(! empty($input['abaikanJam']), ! empty($input['abaikanRadius']));

        return $this->respond(['status' => 'success', 'message' => 'Mode uji absensi berhasil disimpan']);
    }

    // ----------------------------------------------------
    // GET /api/aturan-presensi
    // Dibaca semua peran: penghuni (akurasi GPS, pengingat), fasil (ambang peringatan), admin
    // ----------------------------------------------------
    public function getAturanPresensi()
    {
        return $this->respond((new PengaturanModel())->aturanPresensi());
    }

    // ----------------------------------------------------
    // POST /api/aturan-presensi (admin)
    // ----------------------------------------------------
    public function saveAturanPresensi()
    {
        if (($this->tokenUser()['role'] ?? '') !== 'admin') {
            return $this->failForbidden('Hanya admin yang dapat mengubah aturan presensi.');
        }
        $input = $this->request->getJSON(true) ?? $this->request->getPost();

        $batas = [
            'gpsAkurasiMaks'  => [0, 5000, 'Batas akurasi GPS harus 0–5000 meter (0 = tidak diperiksa).'],
            'batasTidakHadir' => [1, 100, 'Ambang peringatan Tidak Hadir harus 1–100 sesi.'],
            'pengingatMenit'  => [0, 180, 'Waktu pengingat harus 0–180 menit (0 = tidak ada pengingat).'],
        ];
        $aturan = [];
        foreach ($batas as $kunci => [$min, $maks, $pesan]) {
            $nilai = $input[$kunci] ?? null;
            if (! is_numeric($nilai) || (int) $nilai != $nilai || $nilai < $min || $nilai > $maks) {
                return $this->fail($pesan, 400);
            }
            $aturan[$kunci] = (int) $nilai;
        }

        (new PengaturanModel())->simpanAturanPresensi($aturan);

        return $this->respond(['status' => 'success', 'message' => 'Aturan presensi berhasil disimpan']);
    }

    // Payload token login (sama dengan DataController::tokenUser); [] jika tidak valid
    private function tokenUser(): array
    {
        $header = $this->request->getHeaderLine('Authorization');
        $raw = preg_replace('/^Bearer\s+/i', '', $header);
        [$encoded, $signature] = array_pad(explode('.', $raw, 2), 2, '');
        $payload = base64_decode(strtr($encoded, '-_', '+/'));
        $data = json_decode($payload ?: '', true);
        $expected = hash_hmac('sha256', $encoded, env('encryption.key', 'sip-asrama-v1'));
        return $data && hash_equals($expected, $signature) && ($data['exp'] ?? 0) >= time() ? $data : [];
    }

    // ----------------------------------------------------
    // GET /api/libur
    // ----------------------------------------------------
    public function getLibur()
    {
        $data = $this->db->query("
            SELECT
                Id_libur as id,
                Tanggal_mulai as tanggalMulai,
                Tanggal_selesai as tanggalSelesai,
                Keterangan as keterangan
            FROM hari_libur
            ORDER BY Tanggal_mulai DESC
        ")->getResultArray();

        foreach ($data as &$row) {
            $row['id'] = (int) $row['id'];
        }
        return $this->respond($data);
    }

    // ----------------------------------------------------
    // POST /api/libur
    // ----------------------------------------------------
    public function addLibur()
    {
        $input      = $this->request->getJSON(true) ?? $this->request->getPost();
        $mulai      = $input['tanggalMulai'] ?? '';
        $selesai    = $input['tanggalSelesai'] ?? $mulai;
        $keterangan = trim($input['keterangan'] ?? '');

        if (! $mulai || $keterangan === '') {
            return $this->fail('Tanggal mulai dan keterangan wajib diisi.', 400);
        }
        if ($selesai < $mulai) {
            return $this->fail('Tanggal selesai tidak boleh sebelum tanggal mulai.', 400);
        }

        $this->db->table('hari_libur')->insert([
            'Tanggal_mulai'   => $mulai,
            'Tanggal_selesai' => $selesai,
            'Keterangan'      => $keterangan,
            'created_at'      => date('Y-m-d H:i:s'),
            'updated_at'      => date('Y-m-d H:i:s'),
        ]);

        return $this->respondCreated(['status' => 'success', 'message' => 'Hari libur berhasil ditambahkan']);
    }

    // ----------------------------------------------------
    // POST /api/libur/delete
    // ----------------------------------------------------
    public function deleteLibur()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $id    = (int) ($input['id'] ?? 0);

        $this->db->table('hari_libur')->where('Id_libur', $id)->delete();

        return $this->respond(['status' => 'success', 'message' => 'Hari libur berhasil dihapus']);
    }
}
