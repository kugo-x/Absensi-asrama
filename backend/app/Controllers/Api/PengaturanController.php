<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\PresensiService;
use App\Models\PengaturanModel;
use CodeIgniter\API\ResponseTrait;

/**
 * Aturan presensi yang diatur admin: jadwal sesi dan hari libur
 */
class PengaturanController extends BaseController
{
    use ResponseTrait;

    protected $db;

    // id sesi gedung di respons = offset + Id_sesi_gedung (agar tidak bentrok dengan Id_sesi global)
    private const OFFSET_ID_SESI_GEDUNG = 1000000;

    public function __construct()
    {
        $this->db = \Config\Database::connect();
    }

    // ----------------------------------------------------
    // GET /api/sesi
    // Sesi global (diatur admin, idGedung null) + sesi per gedung (diatur fasil, mis. Malam)
    // sesuai lingkup peran: admin = semua gedung; fasil = gedung yang ia pegang; penghuni = gedungnya.
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
            $row['id']          = (int) $row['id'];
            $row['aktif']       = (bool) $row['aktif'];
            $row['idGedung']    = null;
            $row['namaGedung']  = null;
            $row['diaturOleh']  = null;
            $row['namaPengatur'] = null;
        }
        unset($row);

        $token   = $this->tokenUser();
        $builder = $this->db->table('sesi_gedung sg')
            ->select("sg.Id_sesi_gedung, sg.Nama, TIME_FORMAT(sg.Jam_mulai, '%H:%i') AS jamMulai, TIME_FORMAT(sg.Jam_selesai, '%H:%i') AS jamSelesai,
                      sg.Aktif, COALESCE(DATE(sg.created_at), '') AS berlakuSejak, sg.Id_Gedung, g.Nama AS namaGedung, sg.Diatur_oleh, u.Nama AS namaPengatur", false)
            ->join('gedung g', 'g.Id_Gedung = sg.Id_Gedung')
            ->join('user u', 'u.NIM = sg.Diatur_oleh', 'left')
            ->orderBy('g.Nama', 'ASC');
        switch ($token['role'] ?? '') {
            case 'admin':
                break;
            case 'fasil':
                $builder->where('g.NIM_Pj', $token['nim']);
                break;
            case 'penghuni':
                $builder->join('kamar k', 'k.Id_Gedung = sg.Id_Gedung')->join('user p', 'p.Nomor_kamar = k.Nomor_kamar')->where('p.NIM', $token['nim']);
                break;
            default:
                $builder->where('1 = 0', null, false);
        }
        foreach ($builder->get()->getResultArray() as $sg) {
            $data[] = [
                // id dibedakan dari id sesi global agar unik di klien
                'id'           => self::OFFSET_ID_SESI_GEDUNG + (int) $sg['Id_sesi_gedung'],
                'nama'         => $sg['Nama'],
                'jamMulai'     => $sg['jamMulai'],
                'jamSelesai'   => $sg['jamSelesai'],
                'aktif'        => (bool) $sg['Aktif'],
                'berlakuSejak' => $sg['berlakuSejak'],
                'idGedung'     => (int) $sg['Id_Gedung'],
                'namaGedung'   => $sg['namaGedung'],
                'diaturOleh'   => $sg['Diatur_oleh'],
                'namaPengatur' => $sg['namaPengatur'],
            ];
        }

        return $this->respond($data);
    }

    // ----------------------------------------------------
    // POST /api/sesi  (admin)
    // Menyimpan seluruh daftar sesi GLOBAL sekaligus (tambah / ubah).
    // Absen malam tidak termasuk: jadwalnya diatur fasil per gedung (POST /api/sesi-gedung).
    // ----------------------------------------------------
    public function saveSesi()
    {
        if (($this->tokenUser()['role'] ?? '') !== 'admin') {
            return $this->failForbidden('Hanya admin yang dapat mengatur sesi presensi.');
        }
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
            if (strcasecmp($n, PresensiService::SESI_PER_GEDUNG) === 0) {
                return $this->fail('Sesi ' . PresensiService::SESI_PER_GEDUNG . ' diatur oleh fasil masing-masing gedung, bukan oleh admin.', 400);
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
        // Sesi global tidak boleh bertabrakan dengan absen malam yang sudah diatur fasil
        $sesiGedung = $this->db->table('sesi_gedung sg')->select('sg.Nama, sg.Jam_mulai, sg.Jam_selesai, g.Nama AS gedung')
            ->join('gedung g', 'g.Id_Gedung = sg.Id_Gedung')->where('sg.Aktif', 1)->get()->getResultArray();
        foreach ($aktif as $s) {
            foreach ($sesiGedung as $sg) {
                if ($this->bertumpuk($s['jamMulai'], $s['jamSelesai'], $sg['Jam_mulai'], $sg['Jam_selesai'])) {
                    return $this->fail(sprintf(
                        'Sesi %s bertabrakan dengan absen %s %s (%s–%s).',
                        trim($s['nama']), strtolower($sg['Nama']), $sg['gedung'], substr($sg['Jam_mulai'], 0, 5), substr($sg['Jam_selesai'], 0, 5)
                    ), 400);
                }
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
    // POST /api/sesi-gedung  (fasil PJ gedung)
    // Mengatur absen malam gedung yang dipegang fasil: { jamMulai, jamSelesai, aktif }
    // ----------------------------------------------------
    public function saveSesiGedung()
    {
        $token = $this->tokenUser();
        if (($token['role'] ?? '') !== 'fasil') {
            return $this->failForbidden('Hanya fasil yang dapat mengatur absen malam gedung.');
        }
        $gedung = $this->db->table('gedung')->where('NIM_Pj', $token['nim'])->get()->getRowArray();
        if (! $gedung) {
            return $this->failForbidden('Anda belum ditetapkan sebagai PJ gedung mana pun.');
        }

        $input   = $this->request->getJSON(true) ?? $this->request->getPost();
        $mulai   = (string) ($input['jamMulai'] ?? '');
        $selesai = (string) ($input['jamSelesai'] ?? '');
        $aktif   = ! empty($input['aktif']);
        $polaJam = '/^([01]\d|2[0-3]):[0-5]\d$/';
        if (! preg_match($polaJam, $mulai) || ! preg_match($polaJam, $selesai)) {
            return $this->fail('Jam mulai dan jam selesai wajib diisi (format JJ:MM).', 400);
        }
        if ($selesai <= $mulai) {
            return $this->fail('Jam selesai harus setelah jam mulai.', 400);
        }
        // Tidak boleh bertabrakan dengan sesi global (mis. Subuh) yang aktif
        if ($aktif) {
            foreach ($this->db->table('sesi')->where('Aktif', 1)->get()->getResultArray() as $s) {
                if ($this->bertumpuk($mulai, $selesai, $s['Jam_mulai'], $s['Jam_selesai'])) {
                    return $this->fail(sprintf('Jam bertabrakan dengan sesi %s (%s–%s).', $s['Nama'], substr($s['Jam_mulai'], 0, 5), substr($s['Jam_selesai'], 0, 5)), 400);
                }
            }
        }

        $now  = date('Y-m-d H:i:s');
        $nama = PresensiService::SESI_PER_GEDUNG;
        $data = ['Jam_mulai' => $mulai . ':00', 'Jam_selesai' => $selesai . ':00', 'Aktif' => $aktif ? 1 : 0, 'Diatur_oleh' => $token['nim'], 'updated_at' => $now];
        $ada  = $this->db->table('sesi_gedung')->where('Id_Gedung', $gedung['Id_Gedung'])->where('Nama', $nama)->get()->getRowArray();
        if ($ada) {
            $this->db->table('sesi_gedung')->where('Id_sesi_gedung', $ada['Id_sesi_gedung'])->update($data);
        } else {
            $this->db->table('sesi_gedung')->insert($data + ['Id_Gedung' => $gedung['Id_Gedung'], 'Nama' => $nama, 'created_at' => $now]);
        }

        return $this->respond([
            'status'  => 'success',
            'message' => $aktif
                ? sprintf('Absen malam %s disimpan: %s–%s WIB.', $gedung['Nama'], $mulai, $selesai)
                : sprintf('Absen malam %s dinonaktifkan.', $gedung['Nama']),
        ]);
    }

    /** Dua rentang jam (HH:MM atau HH:MM:SS) saling bertumpuk */
    private function bertumpuk(string $mulaiA, string $selesaiA, string $mulaiB, string $selesaiB): bool
    {
        $f = static fn (string $j) => substr($j, 0, 5);

        return $f($mulaiA) <= $f($selesaiB) && $f($mulaiB) <= $f($selesaiA);
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
