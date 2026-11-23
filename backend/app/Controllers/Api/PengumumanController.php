<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use CodeIgniter\API\ResponseTrait;

/**
 * Pengumuman ke penghuni.
 * - Admin: ke seluruh asrama atau gedung tertentu; boleh mengubah/menghapus semua pengumuman.
 * - Fasil: hanya ke gedung binaannya; hanya mengubah/menghapus pengumuman miliknya.
 * - Penghuni: hanya membaca pengumuman yang berlaku untuk gedungnya dan belum kedaluwarsa.
 */
class PengumumanController extends BaseController
{
    use ResponseTrait;

    protected $db;

    public function __construct()
    {
        $this->db = \Config\Database::connect();
    }

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

    private function gedungBinaanFasil(string $nim): ?int
    {
        $row = $this->db->table('gedung')->where('NIM_Pj', $nim)->get()->getRowArray();

        return $row ? (int) $row['Id_Gedung'] : null;
    }

    private function gedungPenghuni(string $nim): ?int
    {
        $row = $this->db->query(
            'SELECT k.Id_Gedung FROM user u JOIN kamar k ON BINARY k.Nomor_kamar = BINARY u.Nomor_kamar WHERE u.NIM = ? LIMIT 1',
            [$nim]
        )->getRowArray();

        return $row ? (int) $row['Id_Gedung'] : null;
    }

    private function bentuk(array $r): array
    {
        return [
            'id'            => (int) $r['id'],
            'judul'         => $r['judul'],
            'isi'           => $r['isi'],
            'penting'       => (bool) $r['penting'],
            'tipe'          => $r['tipe'],
            'idGedung'      => $r['id_gedung'] !== null ? (int) $r['id_gedung'] : null,
            'namaGedung'    => $r['namaGedung'] ?? null,
            'berlakuSampai' => $r['berlaku_sampai'],
            'createdBy'     => $r['created_by'],
            'namaPembuat'   => $r['namaPembuat'] ?? null,
            'peranPembuat'  => strtolower((string) ($r['peranPembuat'] ?? '')) === 'admin' ? 'admin' : 'fasil',
            'dibuatPada'    => $r['created_at'] ? substr($r['created_at'], 0, 16) : null,
            'diubahPada'    => $r['updated_at'] ? substr($r['updated_at'], 0, 16) : null,
        ];
    }

    private function query()
    {
        return $this->db->table('pengumuman p')
            ->select('p.*, g.Nama AS namaGedung, u.Nama AS namaPembuat, u.Role AS peranPembuat')
            ->join('gedung g', 'g.Id_Gedung = p.id_gedung', 'left')
            ->join('user u', 'BINARY u.NIM = BINARY p.created_by', 'left', false)
            ->orderBy('p.penting', 'DESC')
            ->orderBy('p.created_at', 'DESC')
            ->orderBy('p.id', 'DESC');
    }

    // ----------------------------------------------------
    // GET /api/pengumuman
    // ----------------------------------------------------
    public function index()
    {
        $user = $this->tokenUser();
        $role = strtolower($user['role'] ?? '');
        $nim  = $user['nim'] ?? '';
        if ($role === '') {
            return $this->failUnauthorized('Autentikasi diperlukan.');
        }

        $q = $this->query();
        if ($role === 'fasil') {
            // Fasil melihat pengumuman seluruh asrama + gedung binaannya
            $idGedung = $this->gedungBinaanFasil($nim);
            $q->groupStart()->where('p.tipe', 'seluruh');
            if ($idGedung) {
                $q->orWhere('p.id_gedung', $idGedung);
            }
            $q->orWhere('p.created_by', $nim)->groupEnd();
        } elseif ($role !== 'admin') {
            // Penghuni: yang berlaku untuk gedungnya dan belum kedaluwarsa
            $idGedung = $this->gedungPenghuni($nim);
            $q->groupStart()->where('p.tipe', 'seluruh');
            if ($idGedung) {
                $q->orWhere('p.id_gedung', $idGedung);
            }
            $q->groupEnd()
                ->groupStart()->where('p.berlaku_sampai IS NULL', null, false)->orWhere('p.berlaku_sampai >=', date('Y-m-d'))->groupEnd();
        }

        return $this->respond(array_map(fn ($r) => $this->bentuk($r), $q->get()->getResultArray()));
    }

    /** Validasi isian; mengembalikan [data, pesanGalat] */
    private function bacaIsian(array $input, string $role, string $nim, ?array $lama = null): array
    {
        $judul   = trim((string) ($input['judul'] ?? ($lama['judul'] ?? '')));
        $isi     = trim((string) ($input['isi'] ?? ($lama['isi'] ?? '')));
        $penting = array_key_exists('penting', $input) ? (bool) $input['penting'] : (bool) ($lama['penting'] ?? false);
        $sampai  = array_key_exists('berlakuSampai', $input) ? (trim((string) $input['berlakuSampai']) ?: null) : ($lama['berlaku_sampai'] ?? null);

        if (mb_strlen($judul) < 3 || mb_strlen($judul) > 150) {
            return [null, 'Judul pengumuman wajib diisi (3–150 karakter).'];
        }
        if ($isi === '' || mb_strlen($isi) > 2000) {
            return [null, 'Isi pengumuman wajib diisi (maksimal 2000 karakter).'];
        }
        if ($sampai !== null) {
            $d = \DateTime::createFromFormat('Y-m-d', $sampai);
            if (! $d || $d->format('Y-m-d') !== $sampai) {
                return [null, 'Tanggal berlaku tidak valid.'];
            }
            if ($sampai < date('Y-m-d') && ($lama === null || $sampai !== ($lama['berlaku_sampai'] ?? null))) {
                return [null, 'Tanggal berlaku tidak boleh sebelum hari ini.'];
            }
        }

        if ($role === 'fasil') {
            $idGedung = $this->gedungBinaanFasil($nim);
            if (! $idGedung) {
                return [null, 'Anda belum ditunjuk sebagai PJ gedung manapun. Hubungi admin.'];
            }
            $tipe = 'gedung';
        } else {
            $tipe     = ($input['tipe'] ?? ($lama['tipe'] ?? 'seluruh')) === 'gedung' ? 'gedung' : 'seluruh';
            $idGedung = $tipe === 'gedung' ? (int) ($input['idGedung'] ?? ($lama['id_gedung'] ?? 0)) : null;
            if ($tipe === 'gedung' && (! $idGedung || ! $this->db->table('gedung')->where('Id_Gedung', $idGedung)->countAllResults())) {
                return [null, 'Pilih gedung tujuan pengumuman.'];
            }
        }

        return [[
            'judul' => $judul, 'isi' => $isi, 'penting' => $penting ? 1 : 0, 'tipe' => $tipe,
            'id_gedung' => $idGedung, 'berlaku_sampai' => $sampai,
        ], null];
    }

    // ----------------------------------------------------
    // POST /api/pengumuman/add
    // ----------------------------------------------------
    public function add()
    {
        $user = $this->tokenUser();
        $role = strtolower($user['role'] ?? '');
        $nim  = $user['nim'] ?? '';
        if (! in_array($role, ['admin', 'fasil'], true)) {
            return $this->failForbidden('Hanya admin dan fasil yang dapat membuat pengumuman.');
        }

        [$data, $galat] = $this->bacaIsian($this->request->getJSON(true) ?? $this->request->getPost(), $role, $nim);
        if ($galat) {
            return $this->fail($galat, $role === 'fasil' && str_contains($galat, 'PJ') ? 403 : 400);
        }
        $sekarang = date('Y-m-d H:i:s');
        $this->db->table('pengumuman')->insert($data + ['created_by' => $nim, 'created_at' => $sekarang, 'updated_at' => $sekarang]);

        return $this->respondCreated(['status' => 'success', 'message' => 'Pengumuman berhasil dikirim.', 'id' => (int) $this->db->insertID()]);
    }

    /** Pengumuman yang boleh diubah/dihapus pengguna ini; [baris, respons galat] */
    private function milik(int $id, string $role, string $nim): array
    {
        $row = $this->db->table('pengumuman')->where('id', $id)->get()->getRowArray();
        if (! $row) {
            return [null, $this->failNotFound('Pengumuman tidak ditemukan.')];
        }
        if ($role === 'fasil' && $row['created_by'] !== $nim) {
            return [null, $this->failForbidden('Anda hanya dapat mengubah pengumuman yang Anda buat.')];
        }
        if (! in_array($role, ['admin', 'fasil'], true)) {
            return [null, $this->failForbidden('Akses ditolak.')];
        }

        return [$row, null];
    }

    // ----------------------------------------------------
    // POST /api/pengumuman/update  { id, ... }
    // ----------------------------------------------------
    public function update()
    {
        $user  = $this->tokenUser();
        $role  = strtolower($user['role'] ?? '');
        $nim   = $user['nim'] ?? '';
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        [$lama, $galat] = $this->milik((int) ($input['id'] ?? 0), $role, $nim);
        if ($galat) {
            return $galat;
        }

        [$data, $pesan] = $this->bacaIsian($input, $role, $nim, $lama);
        if ($pesan) {
            return $this->fail($pesan, 400);
        }
        $this->db->table('pengumuman')->where('id', $lama['id'])->update($data + ['updated_at' => date('Y-m-d H:i:s')]);

        return $this->respond(['status' => 'success', 'message' => 'Pengumuman berhasil diperbarui.']);
    }

    // ----------------------------------------------------
    // POST /api/pengumuman/delete  { id }
    // ----------------------------------------------------
    public function delete()
    {
        $user  = $this->tokenUser();
        $role  = strtolower($user['role'] ?? '');
        $nim   = $user['nim'] ?? '';
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        [$row, $galat] = $this->milik((int) ($input['id'] ?? 0), $role, $nim);
        if ($galat) {
            return $galat;
        }
        $this->db->table('pengumuman')->where('id', $row['id'])->delete();

        return $this->respond(['status' => 'success', 'message' => 'Pengumuman berhasil dihapus.']);
    }
}
