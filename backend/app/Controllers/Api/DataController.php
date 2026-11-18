<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\PresensiService;
use App\Models\PengaturanModel;
use CodeIgniter\API\ResponseTrait;

class DataController extends BaseController
{
    use ResponseTrait;

    protected $db;
    protected PresensiService $presensiService;

    public function __construct()
    {
        $this->db = \Config\Database::connect();
        $this->presensiService = new PresensiService($this->db);
    }

    // ----------------------------------------------------
    // GET /api/gedung
    // ----------------------------------------------------
    public function getGedung()
    {
        try {
            if ($this->db->tableExists('gedung')) {
                $query = $this->db->query("
                    SELECT 
                        g.Id_Gedung as id,
                        g.Nama as nama,
                        g.NIM_Pj as nimPj,
                        u.Nama as namaPj,
                        g.Latitude as latitude,
                        g.Longitude as longitude,
                        g.Radius_meter as radiusMeter,
                        (SELECT COUNT(*) FROM kamar k WHERE k.Id_Gedung = g.Id_Gedung) as totalKamar,
                        CASE WHEN g.Nama LIKE '%Putri%' THEN 'Putri' ELSE 'Putra' END as jenis
                    FROM gedung g
                    LEFT JOIN user u ON BINARY u.NIM = BINARY g.NIM_Pj
                    ORDER BY g.Id_Gedung ASC
                ");

                $data = $query->getResultArray();
                log_message('error', 'DEBUG: getGedung returned ' . count($data) . ' rows');
                // DECIMAL dari MySQL dikembalikan sebagai string
                foreach ($data as &$row) {
                    $row['id']          = (int) $row['id'];
                    $row['latitude']    = $row['latitude'] !== null ? (float) $row['latitude'] : null;
                    $row['longitude']   = $row['longitude'] !== null ? (float) $row['longitude'] : null;
                    $row['radiusMeter'] = (int) $row['radiusMeter'];
                    $row['totalKamar']  = (int) $row['totalKamar'];
                }
                return $this->respond($data);
            }
        } catch (\Throwable $e) {}
        return $this->respond([]);
    }

    // ----------------------------------------------------
    // POST /api/gedung/add
    // Tambah gedung baru (Admin)
    // ----------------------------------------------------
    public function addGedung()
    {
        $user = $this->tokenUser();
        if (strtolower($user['role'] ?? '') !== 'admin') {
            return $this->failForbidden('Hanya Admin yang dapat menambah gedung.');
        }

        $input  = $this->request->getJSON(true) ?? $this->request->getPost();
        $nama   = trim($input['nama'] ?? '');
        $nimPj  = trim($input['nimPj'] ?? '') ?: null;
        $lat    = isset($input['latitude']) && $input['latitude'] !== '' ? (float) $input['latitude'] : null;
        $lng    = isset($input['longitude']) && $input['longitude'] !== '' ? (float) $input['longitude'] : null;
        $radius = (int) ($input['radiusMeter'] ?? 50);

        if ($nama === '') {
            return $this->fail('Nama gedung wajib diisi.', 400);
        }
        if ($radius < 1) {
            return $this->fail('Radius geofence minimal 1 meter.', 400);
        }

        if (($lat === null) !== ($lng === null)) {
            return $this->fail('Latitude dan Longitude harus diisi keduanya.', 400);
        }

        if ($nimPj !== null) {
            $fasil = $this->db->query("SELECT * FROM user WHERE BINARY NIM = BINARY ? LIMIT 1", [$nimPj])->getRowArray();
            if (! $fasil || strtolower($fasil['Role']) !== 'fasil' || strtolower($fasil['Status_aktif'] ?? '') !== 'aktif') {
                return $this->fail('PJ gedung harus akun fasil yang aktif.', 400);
            }
        }

        $now = date('Y-m-d H:i:s');
        $this->db->table('gedung')->insert([
            'Nama'         => $nama,
            'NIM_Pj'       => $nimPj,
            'Latitude'     => $lat,
            'Longitude'    => $lng,
            'Radius_meter' => $radius,
            'created_at'   => $now,
            'updated_at'   => $now,
        ]);
        $newId = $this->db->insertID();

        if ($nimPj !== null) {
            // Lepas dari gedung lain
            $this->db->table('gedung')->where('NIM_Pj', $nimPj)->where('Id_Gedung !=', $newId)->update(['NIM_Pj' => null]);
        }

        return $this->respondCreated([
            'status'  => 'success',
            'message' => 'Gedung berhasil ditambahkan.',
            'id'      => $newId,
        ]);
    }

    // ----------------------------------------------------
    // POST /api/gedung/update
    // Mengatur nama, titik koordinat & radius geofence gedung
    // ----------------------------------------------------
    public function updateGedung()
    {
        $input  = $this->request->getJSON(true) ?? $this->request->getPost();
        $id     = (int) ($input['id'] ?? 0);
        $nama   = isset($input['nama']) ? trim($input['nama']) : null;
        $lat    = array_key_exists('latitude', $input) && $input['latitude'] !== '' && $input['latitude'] !== null ? (float) $input['latitude'] : null;
        $lng    = array_key_exists('longitude', $input) && $input['longitude'] !== '' && $input['longitude'] !== null ? (float) $input['longitude'] : null;
        $radius = (int) ($input['radiusMeter'] ?? 0);

        if (! $id) {
            return $this->fail('ID gedung wajib diisi.', 400);
        }

        $exists = $this->db->table('gedung')->where('Id_Gedung', $id)->get()->getRowArray();
        if (! $exists) {
            return $this->failNotFound('Gedung tidak ditemukan.');
        }

        $updateData = ['updated_at' => date('Y-m-d H:i:s')];

        if ($nama !== null) {
            if ($nama === '') {
                return $this->fail('Nama gedung tidak boleh kosong.', 400);
            }
            $updateData['Nama'] = $nama;
        }

        if (array_key_exists('radiusMeter', $input)) {
            if ($radius < 1) {
                return $this->fail('Radius geofence minimal 1 meter.', 400);
            }
            $updateData['Radius_meter'] = $radius;
        }

        if (array_key_exists('latitude', $input) || array_key_exists('longitude', $input)) {
            if (($lat === null) !== ($lng === null)) {
                return $this->fail('Latitude dan Longitude harus diisi keduanya.', 400);
            }
            if ($lat !== null && ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180)) {
                return $this->fail('Koordinat tidak valid.', 400);
            }
            $updateData['Latitude']  = $lat;
            $updateData['Longitude'] = $lng;
        }

        if (array_key_exists('nimPj', $input)) {
            $nimPj = trim((string) $input['nimPj']) ?: null;
            if ($nimPj !== null) {
                $fasil = $this->db->query("SELECT * FROM user WHERE BINARY NIM = BINARY ? LIMIT 1", [$nimPj])->getRowArray();
                if (! $fasil || strtolower($fasil['Role']) !== 'fasil' || strtolower($fasil['Status_aktif'] ?? '') !== 'aktif') {
                    return $this->fail('PJ gedung harus akun fasil yang aktif.', 400);
                }
                // Lepas dari gedung lain yang sebelumnya dipegang
                $this->db->table('gedung')->where('NIM_Pj', $nimPj)->where('Id_Gedung !=', $id)->update(['NIM_Pj' => null]);
            }
            $updateData['NIM_Pj'] = $nimPj;
        }

        $this->db->table('gedung')->where('Id_Gedung', $id)->update($updateData);

        return $this->respond(['status' => 'success', 'message' => 'Data gedung berhasil diperbarui']);
    }

    // ----------------------------------------------------
    // POST /api/gedung/delete
    // Hapus gedung (Admin)
    // ----------------------------------------------------
    public function deleteGedung()
    {
        $user = $this->tokenUser();
        if (strtolower($user['role'] ?? '') !== 'admin') {
            return $this->failForbidden('Hanya Admin yang dapat menghapus gedung.');
        }

        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $id    = (int) ($input['id'] ?? 0);

        if (! $id) {
            return $this->fail('ID gedung wajib disertakan.', 400);
        }

        $gedung = $this->db->table('gedung')->where('Id_Gedung', $id)->get()->getRowArray();
        if (! $gedung) {
            return $this->failNotFound('Gedung tidak ditemukan.');
        }

        // Cek kamar yang ada di gedung
        $kamarCount = $this->db->table('kamar')->where('Id_Gedung', $id)->countAllResults();
        if ($kamarCount > 0) {
            return $this->fail(sprintf('Gedung "%s" tidak dapat dihapus karena masih memiliki %d kamar. Hapus atau pindahkan kamar terlebih dahulu.', $gedung['Nama'], $kamarCount), 400);
        }

        $this->db->table('gedung')->where('Id_Gedung', $id)->delete();

        return $this->respond(['status' => 'success', 'message' => 'Gedung berhasil dihapus.']);
    }

    // ----------------------------------------------------
    // POST /api/gedung/pj
    // Menetapkan fasil penanggung jawab gedung (satu fasil = satu gedung)
    // ----------------------------------------------------
    public function setPjGedung()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $id    = (int) ($input['id'] ?? 0);
        $nimPj = trim((string) ($input['nimPj'] ?? '')) ?: null;

        if (! $this->db->table('gedung')->where('Id_Gedung', $id)->countAllResults()) {
            return $this->failNotFound('Gedung tidak ditemukan.');
        }

        if ($nimPj !== null) {
            $fasil = $this->db->query("SELECT * FROM user WHERE BINARY NIM = BINARY ? LIMIT 1", [$nimPj])->getRowArray();
            if (! $fasil || strtolower($fasil['Role']) !== 'fasil' || strtolower($fasil['Status_aktif'] ?? '') !== 'aktif') {
                return $this->fail('PJ gedung harus akun fasil yang aktif.', 400);
            }
            // Lepas dari gedung lain yang sebelumnya dipegang
            $this->db->table('gedung')->where('NIM_Pj', $nimPj)->where('Id_Gedung !=', $id)->update(['NIM_Pj' => null]);
        }

        $this->db->table('gedung')->where('Id_Gedung', $id)->update([
            'NIM_Pj'     => $nimPj,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        return $this->respond(['status' => 'success', 'message' => 'PJ gedung berhasil diperbarui']);
    }

    // ----------------------------------------------------
    // GET /api/kamar
    // ----------------------------------------------------
    public function getKamar()
    {
        try {
            if ($this->db->tableExists('kamar')) {
                $cols = $this->db->getFieldNames('kamar');
                $hasKapasitas = in_array('Kapasitas', $cols, true);
                $hasLantai    = in_array('Lantai', $cols, true);
                $hasIdGedung  = in_array('Id_Gedung', $cols, true);

                $kapasitasCol = $hasKapasitas ? 'k.Kapasitas as kapasitas' : '4 as kapasitas';
                $lantaiCol    = $hasLantai ? 'k.Lantai as lantai' : '1 as lantai';
                $idGedungCol  = $hasIdGedung ? 'k.Id_Gedung as idGedung' : '1 as idGedung';

                $hasGedung    = $this->db->tableExists('gedung');
                $joinGedung   = ($hasIdGedung && $hasGedung) ? 'LEFT JOIN gedung g ON g.Id_Gedung = k.Id_Gedung' : '';
                $namaGedungCol = ($hasIdGedung && $hasGedung) ? "COALESCE(g.Nama, '') as namaGedung" : "'' as namaGedung";

                $hasUser       = $this->db->tableExists('user');
                $countPenghuni = $hasUser 
                    ? "(SELECT COUNT(*) FROM user u WHERE BINARY u.Nomor_kamar = BINARY k.Nomor_kamar AND u.Status_aktif = 'Aktif') as penghuniCount"
                    : "0 as penghuniCount";

                $query = $this->db->query("
                    SELECT
                        k.Nomor_kamar as nomorKamar,
                        {$lantaiCol},
                        {$kapasitasCol},
                        {$idGedungCol},
                        {$namaGedungCol},
                        {$countPenghuni}
                    FROM kamar k
                    {$joinGedung}
                    ORDER BY k.Nomor_kamar ASC
                ");

                $data = $query->getResultArray();
                log_message('error', 'DEBUG: getKamar returned ' . count($data) . ' rows');
                foreach ($data as &$row) {
                    $row['lantai']        = (int) $row['lantai'];
                    $row['kapasitas']     = (int) $row['kapasitas'];
                    $row['idGedung']      = (int) $row['idGedung'];
                    $row['penghuniCount'] = (int) $row['penghuniCount'];
                }
                return $this->respond($data);
            }
        } catch (\Throwable $e) {}
        return $this->respond([]);
    }

    // ----------------------------------------------------
    // POST /api/kamar/add
    // Tambah kamar baru (Admin)
    // ----------------------------------------------------
    public function addKamar()
    {
        $user = $this->tokenUser();
        if (strtolower($user['role'] ?? '') !== 'admin') {
            return $this->failForbidden('Hanya Admin yang dapat menambah kamar.');
        }

        $input      = $this->request->getJSON(true) ?? $this->request->getPost();
        $nomorKamar = strtoupper(trim($input['nomorKamar'] ?? ''));
        $lantai     = (int) ($input['lantai'] ?? 1);
        $kapasitas  = (int) ($input['kapasitas'] ?? 2);
        $idGedung   = (int) ($input['idGedung'] ?? 0);

        if ($nomorKamar === '') {
            return $this->fail('Nomor kamar wajib diisi.', 400);
        }
        if ($lantai < 1) {
            return $this->fail('Lantai minimal 1.', 400);
        }
        if ($kapasitas < 1) {
            return $this->fail('Kapasitas minimal 1 orang.', 400);
        }
        if (! $idGedung || ! $this->db->table('gedung')->where('Id_Gedung', $idGedung)->countAllResults()) {
            return $this->fail('Gedung tidak valid atau tidak ditemukan.', 400);
        }

        $kamarAda = $this->db->table('kamar')->where('Nomor_kamar', $nomorKamar)->countAllResults();
        if ($kamarAda) {
            return $this->fail('Nomor kamar ' . $nomorKamar . ' sudah digunakan.', 400);
        }

        $now = date('Y-m-d H:i:s');
        $this->db->table('kamar')->insert([
            'Nomor_kamar' => $nomorKamar,
            'Lantai'      => $lantai,
            'Kapasitas'   => $kapasitas,
            'Id_Gedung'   => $idGedung,
            'created_at'  => $now,
            'updated_at'  => $now,
        ]);

        return $this->respondCreated([
            'status'  => 'success',
            'message' => 'Kamar ' . $nomorKamar . ' berhasil ditambahkan.',
        ]);
    }

    // ----------------------------------------------------
    // POST /api/kamar/update
    // Edit kamar (kapasitas dan lantai) (Admin)
    // ----------------------------------------------------
    public function updateKamar()
    {
        $user = $this->tokenUser();
        if (strtolower($user['role'] ?? '') !== 'admin') {
            return $this->failForbidden('Hanya Admin yang dapat mengedit kamar.');
        }

        $input      = $this->request->getJSON(true) ?? $this->request->getPost();
        $nomorKamar = strtoupper(trim($input['nomorKamar'] ?? ''));
        $lantai     = (int) ($input['lantai'] ?? 1);
        $kapasitas  = (int) ($input['kapasitas'] ?? 2);
        $idGedung   = isset($input['idGedung']) ? (int) $input['idGedung'] : null;

        if ($nomorKamar === '') {
            return $this->fail('Nomor kamar wajib diisi.', 400);
        }
        if ($lantai < 1) {
            return $this->fail('Lantai minimal 1.', 400);
        }
        if ($kapasitas < 1) {
            return $this->fail('Kapasitas minimal 1 orang.', 400);
        }

        $kamar = $this->db->table('kamar')->where('Nomor_kamar', $nomorKamar)->get()->getRowArray();
        if (! $kamar) {
            return $this->failNotFound('Kamar tidak ditemukan.');
        }

        // Cek jumlah penghuni aktif di kamar saat ini
        $penghuniAktif = $this->db->table('user')
            ->where('Nomor_kamar', $nomorKamar)
            ->where('Status_aktif', 'Aktif')
            ->countAllResults();

        if ($kapasitas < $penghuniAktif) {
            return $this->fail(sprintf(
                'Kapasitas (%d) tidak boleh lebih kecil dari jumlah penghuni aktif saat ini (%d). Pindahkan penghuni terlebih dahulu.',
                $kapasitas,
                $penghuniAktif
            ), 400);
        }

        $updateData = [
            'Lantai'     => $lantai,
            'Kapasitas'  => $kapasitas,
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        if ($idGedung && $this->db->table('gedung')->where('Id_Gedung', $idGedung)->countAllResults()) {
            $updateData['Id_Gedung'] = $idGedung;
        }

        $this->db->table('kamar')->where('Nomor_kamar', $nomorKamar)->update($updateData);

        return $this->respond([
            'status'  => 'success',
            'message' => 'Data kamar ' . $nomorKamar . ' berhasil diperbarui.',
        ]);
    }

    // ----------------------------------------------------
    // POST /api/kamar/delete
    // Hapus kamar (Admin)
    // ----------------------------------------------------
    public function deleteKamar()
    {
        $user = $this->tokenUser();
        if (strtolower($user['role'] ?? '') !== 'admin') {
            return $this->failForbidden('Hanya Admin yang dapat menghapus kamar.');
        }

        $input      = $this->request->getJSON(true) ?? $this->request->getPost();
        $nomorKamar = strtoupper(trim($input['nomorKamar'] ?? ''));

        if ($nomorKamar === '') {
            return $this->fail('Nomor kamar wajib diisi.', 400);
        }

        $kamar = $this->db->table('kamar')->where('Nomor_kamar', $nomorKamar)->get()->getRowArray();
        if (! $kamar) {
            return $this->failNotFound('Kamar tidak ditemukan.');
        }

        $penghuniAktif = $this->db->table('user')
            ->where('Nomor_kamar', $nomorKamar)
            ->where('Status_aktif', 'Aktif')
            ->countAllResults();

        if ($penghuniAktif > 0) {
            return $this->fail(sprintf(
                'Kamar %s tidak dapat dihapus karena masih ditempati %d penghuni aktif. Pindahkan penghuni terlebih dahulu.',
                $nomorKamar,
                $penghuniAktif
            ), 400);
        }

        $this->db->table('kamar')->where('Nomor_kamar', $nomorKamar)->delete();

        return $this->respond([
            'status'  => 'success',
            'message' => 'Kamar ' . $nomorKamar . ' berhasil dihapus.',
        ]);
    }

    // ----------------------------------------------------
    // GET /api/penghuni
    // ----------------------------------------------------
    public function getPenghuni()
    {
        try {
            if (! $this->db->tableExists('user')) {
                return $this->respond([]);
            }

            $hasCreatedAt = false;
            try {
                $hasCreatedAt = in_array('created_at', $this->db->getFieldNames('user'), true);
            } catch (\Throwable $e) {}

            $dateCol = $hasCreatedAt ? "COALESCE(DATE(u.created_at), '') as tanggalMasuk" : "'' as tanggalMasuk";

            $hasKamar = $this->db->tableExists('kamar');
            $hasGedung = $this->db->tableExists('gedung');

            $joinKamar = ($hasKamar) ? "LEFT JOIN kamar k ON BINARY k.Nomor_kamar = BINARY u.Nomor_kamar" : "";
            $joinGedung = ($hasGedung && $hasKamar) ? "LEFT JOIN gedung g ON g.Id_Gedung = k.Id_Gedung" : "";
            $joinGedungPj = ($hasGedung) ? "LEFT JOIN gedung gpj ON BINARY gpj.NIM_Pj = BINARY u.NIM" : "";
            $gedungCol = ($hasGedung)
                ? ($hasKamar ? "COALESCE(g.Nama, gpj.Nama, '') as namaGedung" : "COALESCE(gpj.Nama, '') as namaGedung")
                : "'' as namaGedung";

            $query = $this->db->query("
                SELECT
                    u.NIM as nim,
                    u.Nama as nama,
                    COALESCE(u.Nomor_kamar, '') as nomorKamar,
                    {$gedungCol},
                    u.Asal as asal,
                    u.Email as email,
                    u.No_HP as noHp,
                    u.Password as passwordHash,
                    (u.Status_aktif = 'Aktif') as statusAktif,
                    LOWER(u.Role) as role,
                    {$dateCol}
                FROM user u
                {$joinKamar}
                {$joinGedung}
                {$joinGedungPj}
                WHERE LOWER(u.Role) <> 'admin'
                ORDER BY u.Nama ASC
            ");

            $data = $query->getResultArray();
            log_message('error', 'DEBUG: getPenghuni returned ' . count($data) . ' rows');
            // Convert statusAktif to boolean and normalize roles
            foreach ($data as &$row) {
                $row['statusAktif'] = (bool)$row['statusAktif'];
                if ($row['role'] === 'mahasiswa') {
                    $row['role'] = 'penghuni';
                }
                $row['passwordDefault'] = $row['role'] === 'penghuni' && password_verify('penghuni123', $row['passwordHash'] ?? '');
                unset($row['passwordHash']);
            }
            return $this->respond($data);
        } catch (\Throwable $e) {
            return $this->respond([]);
        }
    }

    /**
     * Sisa tempat di kamar; $abaikanNim tidak dihitung (untuk penghuni yang sudah menempati kamar itu)
     */
    private function kamarTersedia(string $nomorKamar, ?string $abaikanNim = null): ?string
    {
        $kamar = $this->db->table('kamar')->where('Nomor_kamar', $nomorKamar)->get()->getRowArray();
        if (! $kamar) {
            return 'Kamar tidak ditemukan.';
        }
        $builder = $this->db->table('user')->where('Nomor_kamar', $nomorKamar)->where('Status_aktif', 'Aktif');
        if ($abaikanNim !== null) {
            $builder->where('NIM !=', $abaikanNim);
        }
        if ($builder->countAllResults() >= (int) $kamar['Kapasitas']) {
            return 'Kamar ' . $nomorKamar . ' sudah penuh.';
        }

        return null;
    }

    // ----------------------------------------------------
    // POST /api/penghuni
    // ----------------------------------------------------
    public function addPenghuni()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $nim = trim($input['nim'] ?? '');
        $nama = trim($input['nama'] ?? '');
        $nomorKamar = $input['nomorKamar'] ?? '';

        if (!$nim || !$nama || !$nomorKamar) {
            return $this->fail('NIM, Nama, dan Kamar wajib diisi.', 400);
        }

        $exists = $this->db->table('user')->where('NIM', $nim)->countAllResults();
        if ($exists > 0) {
            return $this->fail('User dengan NIM tersebut sudah terdaftar.', 409);
        }
        if ($error = $this->kamarTersedia($nomorKamar)) {
            return $this->fail($error, 400);
        }

        $newUser = [
            'NIM'          => $nim,
            'Nama'         => $nama,
            'Nomor_kamar'  => $nomorKamar,
            'Asal'         => $input['asal'] ?? null,
            'No_HP'        => $input['noHp'] ?? null,
            'Email'        => $input['email'] ?? null,
            'Password'     => password_hash('penghuni123', PASSWORD_BCRYPT),
            'Role'         => 'Mahasiswa',
            'Status_aktif' => 'Aktif',
            'created_at'   => date('Y-m-d H:i:s'),
            'updated_at'   => date('Y-m-d H:i:s'),
        ];

        $this->db->table('user')->insert($newUser);
        return $this->respondCreated(['status' => 'success', 'message' => 'Penghuni berhasil ditambahkan']);
    }

    // ----------------------------------------------------
    // POST /api/penghuni/toggle-status
    // ----------------------------------------------------
    public function togglePenghuniStatus()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $nim = $input['nim'] ?? '';

        $user = $this->db->table('user')->where('NIM', $nim)->get()->getRowArray();
        if (!$user) {
            return $this->failNotFound('User tidak ditemukan.');
        }

        $newStatus = ($user['Status_aktif'] === 'Aktif') ? 'Nonaktif' : 'Aktif';
        $this->db->table('user')->where('NIM', $nim)->update([
            'Status_aktif' => $newStatus,
            'updated_at'   => date('Y-m-d H:i:s')
        ]);

        return $this->respond(['status' => 'success', 'newStatus' => $newStatus]);
    }

    // ----------------------------------------------------
    // POST /api/penghuni/update
    // Pindah kamar, ubah peran, keluarkan (nomorKamar null + nonaktif), atau aktifkan kembali
    // ----------------------------------------------------
    public function updatePenghuni()
    {
        $input       = $this->request->getJSON(true) ?? $this->request->getPost();
        $nim         = $input['nim'] ?? '';
        $nomorKamar  = $input['nomorKamar'] ?? null;
        $role        = ($input['role'] ?? 'penghuni') === 'fasil' ? 'Fasil' : 'Mahasiswa';
        $statusAktif = (bool) ($input['statusAktif'] ?? true);

        $user = $this->db->table('user')->where('NIM', $nim)->get()->getRowArray();
        if (! $user || strtolower($user['Role']) === 'admin') {
            return $this->failNotFound('Penghuni tidak ditemukan.');
        }

        // Data diri; kolom yang tidak dikirim tetap memakai nilai lama
        $nimBaru = trim($input['nimBaru'] ?? $nim);
        $nama    = trim($input['nama'] ?? $user['Nama']);
        $email   = trim($input['email'] ?? (string) $user['Email']);
        if ($nimBaru === '' || $nama === '') {
            return $this->fail('NIM dan nama wajib diisi.', 400);
        }
        if (strlen($nimBaru) > 20 || ! preg_match('/^[A-Za-z0-9]+$/', $nimBaru)) {
            return $this->fail('NIM hanya boleh berisi huruf dan angka (maksimal 20 karakter).', 400);
        }
        if ($nimBaru !== $nim && $this->db->table('user')->where('NIM', $nimBaru)->countAllResults()) {
            return $this->fail('NIM ' . $nimBaru . ' sudah terdaftar.', 409);
        }
        if ($email !== '' && ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->fail('Format email tidak valid.', 400);
        }

        if ($statusAktif && ! $nomorKamar) {
            return $this->fail('Penghuni aktif wajib menempati kamar.', 400);
        }
        if ($statusAktif && ($nomorKamar !== $user['Nomor_kamar'] || $user['Status_aktif'] !== 'Aktif')) {
            if ($error = $this->kamarTersedia($nomorKamar, $nim)) {
                return $this->fail($error, 400);
            }
        }

        $this->db->transStart();
        // Perubahan NIM ikut ke presensi, izin, dan PJ gedung lewat foreign key ON UPDATE CASCADE
        $this->db->table('user')->where('NIM', $nim)->update([
            'NIM'          => $nimBaru,
            'Nama'         => $nama,
            'Email'        => $email !== '' ? $email : null,
            'No_HP'        => array_key_exists('noHp', $input) ? (trim($input['noHp']) ?: null) : $user['No_HP'],
            'Asal'         => array_key_exists('asal', $input) ? (trim($input['asal']) ?: null) : $user['Asal'],
            'Nomor_kamar'  => $statusAktif ? $nomorKamar : null,
            'Role'         => $role,
            'Status_aktif' => $statusAktif ? 'Aktif' : 'Nonaktif',
            'updated_at'   => date('Y-m-d H:i:s'),
        ]);
        // Bukan fasil aktif lagi -> lepas dari jabatan PJ gedung
        if ($role !== 'Fasil' || ! $statusAktif) {
            $this->db->table('gedung')->where('NIM_Pj', $nimBaru)->update(['NIM_Pj' => null]);
        }
        $this->db->transComplete();
        if (! $this->db->transStatus()) {
            return $this->failServerError('Data penghuni gagal disimpan.');
        }

        return $this->respond(['status' => 'success', 'message' => 'Data penghuni berhasil diperbarui']);
    }

    public function resetPassword()
    {
        $token = $this->tokenUser();
        if (($token['role'] ?? '') !== 'admin') return $this->failForbidden('Hanya admin yang dapat mereset password.');
        $input = $this->request->getJSON(true) ?? [];
        $nim = trim($input['nim'] ?? '');
        $adminNim = trim($input['adminNim'] ?? '');
        $adminPassword = (string) ($input['adminPassword'] ?? '');
        $admin = $this->db->table('user')->where('NIM', $token['nim'] ?? '')->get()->getRowArray();
        if (!$admin || $adminNim !== ($token['nim'] ?? '') || !$adminPassword || !password_verify($adminPassword, $admin['Password'])) {
            return $this->fail('Verifikasi username atau password admin gagal.', 401);
        }
        $user = $this->db->table('user')->where('NIM', $nim)->get()->getRowArray();
        if (!$user || strtolower($user['Role']) === 'admin') return $this->failNotFound('Penghuni tidak ditemukan.');
        if (password_verify('penghuni123', $user['Password'])) {
            return $this->fail('Password akun ini sudah menggunakan password default penghuni123.', 409);
        }
        $this->db->table('user')->where('NIM', $nim)->update([
            'Password' => password_hash('penghuni123', PASSWORD_BCRYPT),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        return $this->respond(['status' => 'success', 'message' => 'Password direset ke penghuni123.']);
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

    // ----------------------------------------------------
    // GET /api/presensi
    // ----------------------------------------------------
    public function getPresensi()
    {
        try {
            if (! $this->db->tableExists('presensi')) {
                return $this->respond([]);
            }
            // Sesi yang sudah ditutup langsung tercatat Tidak Hadir tanpa menunggu cron (dibatasi tiap 5 menit).
            // Di lingkungan testing dimatikan agar tes tetap deterministik; logikanya diuji langsung lewat service.
            if (ENVIRONMENT !== 'testing') {
                $this->presensiService->tandaiOtomatisBerkala();
            }

            // Lingkup data mengikuti peran: penghuni = miliknya sendiri, fasil = penghuni gedung yang ia pegang,
            // admin = semua. Mencegah penghuni melihat presensi & nama berkas foto wajah penghuni lain.
            $token = $this->tokenUser();
            $binds = [];
            $hasGedung = $this->db->tableExists('gedung');
            switch ($token['role'] ?? '') {
                case 'admin':
                    $where = '';
                    break;
                case 'fasil':
                    $where   = $hasGedung ? 'WHERE g.NIM_Pj = ?' : '';
                    if ($hasGedung) $binds[] = $token['nim'];
                    break;
                case 'penghuni':
                    $where   = 'WHERE BINARY p.NIM = BINARY ?';
                    $binds[] = $token['nim'];
                    break;
                default:
                    return $this->failForbidden('Akses data presensi tidak diizinkan.');
            }

            $cols = $this->db->getFieldNames('presensi');
            $hasAkurasi     = in_array('Akurasi_meter', $cols, true);
            $hasDikoreksi   = in_array('Dikoreksi_oleh', $cols, true);
            $hasStatusFoto  = in_array('Status_foto', $cols, true);
            $hasCatatanFoto = in_array('Catatan_validasi', $cols, true);
            $hasDivalidasi  = in_array('Divalidasi_oleh', $cols, true);
            $hasDivalidasiPada = in_array('Divalidasi_pada', $cols, true);
            $hasWaktu       = in_array('Waktu', $cols, true);
            $hasLat         = in_array('Latitude', $cols, true);
            $hasLng         = in_array('Longitude', $cols, true);
            $hasFoto        = in_array('Foto_wajah', $cols, true);
            $hasKet         = in_array('Keterangan', $cols, true);

            $akurasiCol    = $hasAkurasi ? 'p.Akurasi_meter as akurasiMeter' : 'NULL as akurasiMeter';
            $dikoreksiCol  = $hasDikoreksi ? 'p.Dikoreksi_oleh as dikoreksiOleh' : 'NULL as dikoreksiOleh';
            $statusFotoCol = $hasStatusFoto ? 'p.Status_foto as statusFoto' : "'Disetujui' as statusFoto";
            $catatanValCol = $hasCatatanFoto ? "COALESCE(p.Catatan_validasi, '') as catatanValidasi" : "'' as catatanValidasi";
            $divalidasiCol = $hasDivalidasi ? "p.Divalidasi_oleh as divalidasiOleh, validator.Nama as namaValidator" : "NULL as divalidasiOleh, '' as namaValidator";
            $joinValidator = $hasDivalidasi ? "LEFT JOIN user validator ON BINARY validator.NIM = BINARY p.Divalidasi_oleh" : "";
            $divPadaCol    = $hasDivalidasiPada ? "COALESCE(DATE_FORMAT(p.Divalidasi_pada, '%Y-%m-%d %H:%i'), '') as divalidasiPada" : "'' as divalidasiPada";
            $waktuCol      = $hasWaktu ? "COALESCE(DATE_FORMAT(p.Waktu, '%H:%i'), '') as waktu" : "'' as waktu";
            $latCol        = $hasLat ? 'p.Latitude as latitude' : 'NULL as latitude';
            $lngCol        = $hasLng ? 'p.Longitude as longitude' : 'NULL as longitude';
            $fotoCol       = $hasFoto ? "COALESCE(p.Foto_wajah, '') as fotoWajah" : "'' as fotoWajah";
            $ketCol        = $hasKet ? "COALESCE(p.Keterangan, '') as keterangan" : "'' as keterangan";
            $otomatisCol   = $hasKet ? "(p.Keterangan LIKE '" . PresensiService::KETERANGAN_OTOMATIS . "%'" . ($hasDikoreksi ? " AND p.Dikoreksi_oleh IS NULL" : "") . ") as otomatis" : "0 as otomatis";

            $hasUser  = $this->db->tableExists('user');
            $hasKamar = $this->db->tableExists('kamar');

            $namaPenghuniCol = $hasUser ? 'u.Nama as namaPenghuni' : "'' as namaPenghuni";
            $nomorKamarCol   = ($hasUser && $hasKamar) ? "COALESCE(u.Nomor_kamar, '') as nomorKamar" : "'' as nomorKamar";
            $namaGedungCol   = ($hasKamar && $hasGedung) ? "COALESCE(g.Nama, '') as namaGedung" : "'' as namaGedung";

            $joinUser   = $hasUser ? "LEFT JOIN user u ON BINARY u.NIM = BINARY p.NIM" : "";
            $joinKamar  = ($hasUser && $hasKamar) ? "LEFT JOIN kamar k ON BINARY k.Nomor_kamar = BINARY u.Nomor_kamar" : "";
            $joinGedung = ($hasKamar && $hasGedung) ? "LEFT JOIN gedung g ON g.Id_Gedung = k.Id_Gedung" : "";

            $query = $this->db->query("
                SELECT
                    p.Id_presensi as id,
                    p.NIM as nim,
                    {$namaPenghuniCol},
                    {$nomorKamarCol},
                    {$namaGedungCol},
                    p.Tanggal as tanggal,
                    p.Sesi as sesi,
                    {$waktuCol},
                    {$latCol},
                    {$lngCol},
                    {$akurasiCol},
                    p.Status as status,
                    {$fotoCol},
                    {$ketCol},
                    {$dikoreksiCol},
                    {$statusFotoCol},
                    {$catatanValCol},
                    {$divalidasiCol},
                    {$divPadaCol},
                    {$otomatisCol}
                FROM presensi p
                {$joinUser}
                {$joinValidator}
                {$joinKamar}
                {$joinGedung}
                {$where}
                ORDER BY p.Tanggal DESC, p.Id_presensi DESC
            ", $binds);

            $data = $query->getResultArray();
            foreach ($data as &$row) {
                $row['id']        = (int) $row['id'];
                $row['latitude']  = $row['latitude'] !== null ? (float) $row['latitude'] : null;
                $row['longitude'] = $row['longitude'] !== null ? (float) $row['longitude'] : null;
                $row['otomatis']  = (bool) $row['otomatis'];
                $row['akurasiMeter'] = $row['akurasiMeter'] !== null ? (float) $row['akurasiMeter'] : null;
            }
            return $this->respond($data);
        } catch (\Throwable $e) {
            return $this->respond([]);
        }
    }

    // ----------------------------------------------------
    // POST /api/presensi
    // Presensi mandiri: sesi harus sedang dibuka, bukan libur, tidak sedang izin, dan dalam radius gedung
    // ----------------------------------------------------
    public function checkIn()
    {
        $token = $this->tokenUser();
        if (($token['role'] ?? '') !== 'penghuni') {
            return $this->failForbidden('Hanya penghuni yang dapat melakukan presensi.');
        }
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        // NIM dari token login, bukan dari body, agar tidak bisa mengabsenkan orang lain
        $nim = $token['nim'] ?? '';
        $sesi = $input['sesi'] ?? '';
        // Tanggal & jam selalu dari server agar tidak bisa dimanipulasi klien
        $tanggal = date('Y-m-d');
        $jam = date('H:i:s');
        $waktu = date('Y-m-d H:i:s');
        $latitude = $input['latitude'] ?? null;
        $longitude = $input['longitude'] ?? null;
        $keterangan = $input['keterangan'] ?? 'Hadir via Web';

        if (!$nim || !$sesi) {
            return $this->fail('NIM dan sesi wajib diisi.', 400);
        }
        if (!is_numeric($latitude) || !is_numeric($longitude)) {
            return $this->fail('Lokasi GPS wajib dikirim untuk melakukan presensi.', 400);
        }
        // Radius ketidakpastian lokasi dari perangkat (meter); null jika klien lama tidak mengirimnya
        $akurasi = $input['akurasi'] ?? null;
        if ($akurasi !== null && (!is_numeric($akurasi) || $akurasi < 0)) {
            return $this->fail('Nilai akurasi GPS tidak valid.', 400);
        }
        $akurasi = $akurasi !== null ? round((float) $akurasi, 2) : null;
        $foto = $this->dekodeFotoWajah($input['fotoWajah'] ?? null);
        if ($foto === null) {
            return $this->fail('Foto wajah wajib diambil (format JPEG/PNG, maksimal 2 MB).', 400);
        }

        $user = $this->db->table('user')->where('NIM', $nim)->get()->getRowArray();
        if (!$user || $user['Status_aktif'] !== 'Aktif') {
            return $this->fail('Akun tidak aktif.', 403);
        }

        // Mode uji (diatur admin) melonggarkan aturan jam sesi dan/atau radius GPS
        $modeUji = (new PengaturanModel())->modeUji();
        if ($modeUji['abaikanJam'] || $modeUji['abaikanRadius']) {
            $keterangan .= ' [Mode Uji]';
        }

        // Sesi global (admin) atau sesi gedung penghuni (fasil, mis. Malam)
        $dataSesi = $this->presensiService->cariSesiAktif($nim, $sesi, $tanggal);
        if (!$dataSesi) {
            return $this->fail(strcasecmp($sesi, PresensiService::SESI_PER_GEDUNG) === 0
                ? 'Tidak ada absen ' . strtolower($sesi) . ' hari ini: belum diatur, dinonaktifkan, atau diliburkan oleh fasil gedung Anda.'
                : 'Sesi ' . $sesi . ' tidak tersedia.', 400);
        }
        if (!$modeUji['abaikanJam'] && $jam < $dataSesi['Jam_mulai']) {
            return $this->fail(sprintf(
                'Presensi sesi %s hanya dibuka pukul %s–%s WIB.',
                $sesi, substr($dataSesi['Jam_mulai'], 0, 5), substr($dataSesi['Jam_selesai'], 0, 5)
            ), 403);
        }
        if ($libur = $this->presensiService->cariLibur($tanggal)) {
            return $this->fail('Hari ini libur (' . $libur['Keterangan'] . '), tidak ada kewajiban presensi.', 400);
        }
        if ($this->presensiService->cariIzinDisetujui($nim, $tanggal, $sesi)) {
            return $this->fail('Anda berstatus izin pada sesi ini.', 400);
        }
        // Absen setelah batas waktu sesi = alpa: langsung dicatat Tidak Hadir (sama seperti command penandaan otomatis)
        if (!$modeUji['abaikanJam'] && $jam > $dataSesi['Jam_selesai']) {
            $this->presensiService->tandaiTidakHadir($tanggal, $waktu);
            $baris  = $this->db->table('presensi')->where('NIM', $nim)->where('Tanggal', $tanggal)->where('Sesi', $sesi)->get()->getRowArray();
            $status = $baris['Status'] ?? 'Tidak Hadir';

            return $this->fail(sprintf(
                'Sesi %s sudah ditutup pukul %s WIB. Absen melewati batas waktu tidak diterima; Anda tercatat %s.',
                $sesi, substr($dataSesi['Jam_selesai'], 0, 5), $status === 'Tidak Hadir' ? 'Tidak Hadir (alpa)' : $status
            ), 403);
        }

        $existing = $this->db->table('presensi')
            ->where('NIM', $nim)
            ->where('Tanggal', $tanggal)
            ->where('Sesi', $sesi)
            ->countAllResults();
        if ($existing) {
            return $this->fail('Presensi sesi ' . $sesi . ' hari ini sudah tercatat.', 409);
        }

        // Ambil titik koordinat gedung tempat kamar mahasiswa berada
        $gedung = $this->db->table('user u')
            ->select('g.Nama, g.Latitude, g.Longitude, g.Radius_meter')
            ->join('kamar k', 'k.Nomor_kamar = u.Nomor_kamar')
            ->join('gedung g', 'g.Id_Gedung = k.Id_Gedung')
            ->where('u.NIM', $nim)
            ->get()->getRowArray();

        if (!$gedung) {
            return $this->fail('Mahasiswa belum terdaftar di kamar/gedung manapun.', 400);
        }
        if ($gedung['Latitude'] === null || $gedung['Longitude'] === null) {
            return $this->fail('Koordinat gedung ' . $gedung['Nama'] . ' belum diatur oleh admin.', 400);
        }

        // Lokasi yang terlalu tidak akurat tidak bisa membuktikan penghuni berada dalam radius gedung.
        // Mode uji "abaikan radius" ikut melewati pemeriksaan ini karena keduanya soal validasi lokasi.
        $akurasiMaks = (new PengaturanModel())->aturanPresensi()['gpsAkurasiMaks'];
        if ($akurasiMaks > 0 && !$modeUji['abaikanRadius']) {
            if ($akurasi === null) {
                return $this->fail('Akurasi GPS tidak terbaca. Muat ulang halaman lalu coba lagi.', 400);
            }
            if ($akurasi > $akurasiMaks) {
                return $this->fail(sprintf(
                    'Akurasi GPS Anda ±%d m, melebihi batas %d m. Aktifkan GPS/mode akurasi tinggi, pindah ke area terbuka, lalu coba lagi.',
                    round($akurasi), $akurasiMaks
                ), 403);
            }
        }

        $jarak  = $this->haversine((float) $latitude, (float) $longitude, (float) $gedung['Latitude'], (float) $gedung['Longitude']);
        $radius = (int) $gedung['Radius_meter'];
        if ($jarak > $radius && !$modeUji['abaikanRadius']) {
            return $this->fail(sprintf(
                'Anda berada %d m dari %s. Presensi hanya dapat dilakukan dalam radius %d m.',
                round($jarak), $gedung['Nama'], $radius
            ), 403);
        }

        // Simpan foto di writable/ (tidak bisa diakses langsung dari URL publik)
        $dir = WRITEPATH . 'uploads/wajah/';
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            return $this->failServerError('Folder penyimpanan foto tidak dapat dibuat.');
        }
        $namaFoto = sprintf(
            '%s_%s_%s_%s.%s',
            preg_replace('/[^A-Za-z0-9]/', '', $nim), $tanggal, preg_replace('/[^A-Za-z0-9]/', '', $sesi),
            bin2hex(random_bytes(4)), $foto['ext']
        );
        if (file_put_contents($dir . $namaFoto, $foto['data']) === false) {
            return $this->failServerError('Foto wajah gagal disimpan.');
        }

        $this->db->table('presensi')->insert([
            'NIM'        => $nim,
            'Tanggal'    => $tanggal,
            'Sesi'       => $sesi,
            'Waktu'      => $waktu,
            'Latitude'   => $latitude,
            'Longitude'  => $longitude,
            'Akurasi_meter' => $akurasi,
            'Status'     => 'Hadir',
            'Foto_wajah' => $namaFoto,
            'Status_foto' => 'Menunggu', // menunggu validasi fasil PJ gedung
            'Keterangan' => $keterangan,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        return $this->respond([
            'status'  => 'success',
            'message' => sprintf('Presensi berhasil dicatat (jarak %d m dari gedung)', round($jarak)),
        ]);
    }

    // ----------------------------------------------------
    // GET /api/presensi/foto/{nama}
    // ----------------------------------------------------
    public function fotoWajah(string $nama)
    {
        // Hanya nama berkas yang dibuat checkIn; mencegah akses ke berkas lain (path traversal)
        if (!preg_match('/^[A-Za-z0-9_-]+\.(jpg|png)$/', $nama)) {
            return $this->failNotFound('Foto tidak ditemukan.');
        }
        $path = WRITEPATH . 'uploads/wajah/' . $nama;
        if (!is_file($path)) {
            return $this->failNotFound('Foto tidak ditemukan.');
        }

        // Foto wajah adalah data pribadi: hanya pemilik, fasil PJ gedungnya, dan admin.
        // Selain itu dijawab 404 agar keberadaan berkas tidak terungkap.
        $token  = $this->tokenUser();
        $pemilik = $this->db->table('presensi')->select('NIM')->where('Foto_wajah', $nama)->get()->getRowArray();
        $boleh = $pemilik && match ($token['role'] ?? '') {
            'admin'    => true,
            'penghuni' => $pemilik['NIM'] === ($token['nim'] ?? ''),
            'fasil'    => $this->adalahPjPenghuni($token['nim'] ?? '', $pemilik['NIM']),
            default    => false,
        };
        if (!$boleh) {
            return $this->failNotFound('Foto tidak ditemukan.');
        }

        return $this->response
            ->setContentType(str_ends_with($nama, '.png') ? 'image/png' : 'image/jpeg')
            ->setHeader('Cache-Control', 'private, max-age=86400')
            ->setBody(file_get_contents($path));
    }

    /**
     * Dekode data URL foto wajah; null jika bukan gambar JPEG/PNG yang valid atau melebihi 2 MB
     *
     * @return array{data: string, ext: string}|null
     */
    private function dekodeFotoWajah($dataUrl): ?array
    {
        if (!is_string($dataUrl) || !preg_match('#^data:image/(jpeg|png);base64,#', $dataUrl, $m)) {
            return null;
        }
        $data = base64_decode(substr($dataUrl, strlen($m[0])), true);
        if ($data === false || $data === '' || strlen($data) > 2 * 1024 * 1024) {
            return null;
        }
        // Pastikan isinya benar-benar gambar, bukan sekadar berlabel gambar
        $info = @getimagesizefromstring($data);
        if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)) {
            return null;
        }

        return ['data' => $data, 'ext' => $info[2] === IMAGETYPE_PNG ? 'png' : 'jpg'];
    }

    /**
     * Jarak dua titik koordinat dalam meter (rumus Haversine)
     */
    private function haversine(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $r    = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a    = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return 2 * $r * asin(sqrt($a));
    }

    /**
     * Apakah $nimFasil adalah PJ gedung tempat $nimPenghuni tinggal
     */
    private function adalahPjPenghuni(string $nimFasil, string $nimPenghuni): bool
    {
        return $this->db->table('user u')
            ->join('kamar k', 'k.Nomor_kamar = u.Nomor_kamar')
            ->join('gedung g', 'g.Id_Gedung = k.Id_Gedung')
            ->where('u.NIM', $nimPenghuni)
            ->where('g.NIM_Pj', $nimFasil)
            ->countAllResults() > 0;
    }

    // ----------------------------------------------------
    // POST /api/presensi/koreksi
    // Koreksi manual oleh fasil PJ gedung (misal GPS bermasalah)
    // ----------------------------------------------------
    public function koreksiPresensi()
    {
        $token = $this->tokenUser();
        if (($token['role'] ?? '') !== 'fasil') {
            return $this->failForbidden('Hanya fasil yang dapat mengoreksi presensi.');
        }
        $input       = $this->request->getJSON(true) ?? $this->request->getPost();
        $nim         = $input['nim'] ?? '';
        $tanggal     = $input['tanggal'] ?? '';
        $sesi        = $input['sesi'] ?? '';
        $status      = $input['status'] ?? '';
        $keterangan  = trim($input['keterangan'] ?? '');
        // Korektor dari token login, bukan dari body
        $korektorNim = $token['nim'] ?? '';

        if (!$nim || !$tanggal || !$sesi || !$korektorNim) {
            return $this->fail('Data koreksi tidak lengkap.', 400);
        }
        if (!in_array($status, ['Hadir', 'Izin', 'Tidak Hadir'], true)) {
            return $this->fail('Status koreksi tidak valid.', 400);
        }
        if ($keterangan === '') {
            return $this->fail('Keterangan koreksi wajib diisi.', 400);
        }
        if ($tanggal > date('Y-m-d')) {
            return $this->fail('Tidak dapat mengoreksi presensi tanggal yang akan datang.', 400);
        }
        if (!$this->adalahPjPenghuni($korektorNim, $nim)) {
            return $this->fail('Hanya fasil PJ gedung penghuni ini yang dapat mengoreksi presensi.', 403);
        }

        $existing = $this->db->table('presensi')
            ->where('NIM', $nim)->where('Tanggal', $tanggal)->where('Sesi', $sesi)
            ->get()->getRowArray();

        $data = [
            'Status'         => $status,
            'Keterangan'     => $keterangan,
            'Dikoreksi_oleh' => $korektorNim,
            'updated_at'     => date('Y-m-d H:i:s'),
        ];
        if ($existing) {
            $this->db->table('presensi')->where('Id_presensi', $existing['Id_presensi'])->update($data);
        } else {
            $this->db->table('presensi')->insert($data + [
                'NIM'         => $nim,
                'Tanggal'     => $tanggal,
                'Sesi'        => $sesi,
                'Waktu'       => date('Y-m-d H:i:s'),
                'Status_foto' => null, // koreksi manual tanpa foto
                'created_at'  => date('Y-m-d H:i:s'),
            ]);
        }

        return $this->respond(['status' => 'success', 'message' => 'Presensi berhasil dikoreksi']);
    }

    // ----------------------------------------------------
    // POST /api/presensi/validasi-foto
    // Fasil PJ gedung memeriksa foto wajah presensi mandiri. Foto ditolak -> presensi menjadi Tidak Hadir.
    // ----------------------------------------------------
    public function validasiFoto()
    {
        $token = $this->tokenUser();
        if (($token['role'] ?? '') !== 'fasil') {
            return $this->failForbidden('Hanya fasil yang dapat memvalidasi foto presensi.');
        }
        $fasilNim = $token['nim'] ?? '';

        $input   = $this->request->getJSON(true) ?? $this->request->getPost();
        $id      = (int) ($input['id'] ?? 0);
        $status  = $input['status'] ?? '';
        $catatan = trim($input['catatan'] ?? '');

        if (! $id || ! in_array($status, ['Diterima', 'Ditolak'], true)) {
            return $this->fail('ID presensi dan status validasi (Diterima/Ditolak) wajib diisi.', 400);
        }
        if ($status === 'Ditolak' && $catatan === '') {
            return $this->fail('Catatan wajib diisi saat menolak foto.', 400);
        }

        $presensi = $this->db->table('presensi')->where('Id_presensi', $id)->get()->getRowArray();
        if (! $presensi) {
            return $this->failNotFound('Presensi tidak ditemukan.');
        }
        if (empty($presensi['Foto_wajah']) || $presensi['Status_foto'] === null) {
            return $this->fail('Presensi ini tidak memiliki foto untuk divalidasi.', 400);
        }
        if ($presensi['Status_foto'] !== 'Menunggu') {
            return $this->fail('Foto presensi ini sudah divalidasi.', 409);
        }
        if (! $this->adalahPjPenghuni($fasilNim, $presensi['NIM'])) {
            return $this->fail('Hanya fasil PJ gedung penghuni ini yang dapat memvalidasi foto.', 403);
        }

        $now  = date('Y-m-d H:i:s');
        $data = [
            'Status_foto'      => $status,
            'Catatan_validasi' => $catatan !== '' ? $catatan : null,
            'Divalidasi_oleh'  => $fasilNim,
            'Divalidasi_pada'  => $now,
            'updated_at'       => $now,
        ];
        if ($status === 'Ditolak') {
            // Foto tidak sah = kehadiran tidak terbukti; dicatat sebagai koreksi fasil untuk audit
            $data += [
                'Status'         => 'Tidak Hadir',
                'Keterangan'     => 'Foto ditolak: ' . $catatan,
                'Dikoreksi_oleh' => $fasilNim,
            ];
        }

        // Syarat Status_foto = 'Menunggu' di WHERE mencegah dua fasil memutuskan bersamaan
        $this->db->table('presensi')->where('Id_presensi', $id)->where('Status_foto', 'Menunggu')->update($data);
        if ($this->db->affectedRows() === 0) {
            return $this->fail('Foto presensi ini sudah divalidasi.', 409);
        }

        return $this->respond([
            'status'  => 'success',
            'message' => $status === 'Diterima' ? 'Foto presensi diterima' : 'Foto ditolak, presensi dicatat Tidak Hadir',
        ]);
    }

    // ----------------------------------------------------
    // POST /api/presensi/validasi-foto-massal  { ids: number[] }
    // Fasil menerima banyak foto sekaligus. Penolakan tetap satu per satu karena wajib bercatatan.
    // Foto yang sudah divalidasi atau bukan milik gedungnya dilewati, bukan menggagalkan semuanya.
    // ----------------------------------------------------
    public function validasiFotoMassal()
    {
        $token = $this->tokenUser();
        if (($token['role'] ?? '') !== 'fasil') {
            return $this->failForbidden('Hanya fasil yang dapat memvalidasi foto presensi.');
        }
        $fasilNim = $token['nim'] ?? '';

        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $ids   = $input['ids'] ?? null;
        if (! is_array($ids) || $ids === []) {
            return $this->fail('Pilih minimal satu foto presensi.', 400);
        }
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn ($id) => $id > 0)));
        if ($ids === [] || count($ids) > 500) {
            return $this->fail('Daftar foto presensi tidak valid (maksimal 500 sekaligus).', 400);
        }

        // Hanya foto Menunggu milik penghuni gedung yang dipegang fasil ini
        $milik = $this->db->table('presensi p')
            ->select('p.Id_presensi')
            ->join('user u', 'u.NIM = p.NIM')
            ->join('kamar k', 'k.Nomor_kamar = u.Nomor_kamar')
            ->join('gedung g', 'g.Id_Gedung = k.Id_Gedung')
            ->whereIn('p.Id_presensi', $ids)
            ->where('g.NIM_Pj', $fasilNim)
            ->where('p.Status_foto', 'Menunggu')
            ->where("p.Foto_wajah IS NOT NULL AND p.Foto_wajah <> ''", null, false)
            ->get()->getResultArray();
        $idMilik = array_map('intval', array_column($milik, 'Id_presensi'));

        $diterima = 0;
        if ($idMilik !== []) {
            $now = date('Y-m-d H:i:s');
            $this->db->transStart();
            $this->db->table('presensi')
                ->whereIn('Id_presensi', $idMilik)
                ->where('Status_foto', 'Menunggu')
                ->update(['Status_foto' => 'Diterima', 'Catatan_validasi' => null, 'Divalidasi_oleh' => $fasilNim, 'Divalidasi_pada' => $now, 'updated_at' => $now]);
            $diterima = $this->db->affectedRows();
            $this->db->transComplete();
            if (! $this->db->transStatus()) {
                return $this->fail('Validasi foto gagal disimpan.', 500);
            }
        }
        $dilewati = count($ids) - $diterima;

        return $this->respond([
            'status'   => 'success',
            'diterima' => $diterima,
            'dilewati' => $dilewati,
            'message'  => $diterima . ' foto diterima' . ($dilewati > 0 ? ', ' . $dilewati . ' dilewati (sudah divalidasi atau bukan gedung Anda)' : '') . '.',
        ]);
    }

    // ----------------------------------------------------
    // GET /api/izin
    // ----------------------------------------------------
    public function getIzin()
    {
        try {
            if (! $this->db->tableExists('izin')) {
                return $this->respond([]);
            }

            $cols = $this->db->getFieldNames('izin');
            $hasTglSelesai   = in_array('Tanggal_selesai', $cols, true);
            $hasSesi         = in_array('Sesi', $cols, true);
            $hasHariBerulang = in_array('Hari_berulang', $cols, true);
            $hasCatatanApp   = in_array('Catatan_approver', $cols, true);
            $hasTglApp       = in_array('Tanggal_approval', $cols, true);
            $hasApprover     = in_array('NIM_approver', $cols, true);
            $hasBukti        = in_array('File_bukti', $cols, true);
            $hasSebelumnya   = in_array('Id_izin_sebelumnya', $cols, true);

            $tglSelesaiCol   = $hasTglSelesai ? "COALESCE(i.Tanggal_selesai, i.Tanggal) as tanggalSelesai" : "i.Tanggal as tanggalSelesai";
            $sesiCol         = $hasSesi ? "i.Sesi as sesi" : "NULL as sesi";
            $hariBerulangCol = $hasHariBerulang ? "i.Hari_berulang as hariBerulang" : "NULL as hariBerulang";
            $catatanAppCol   = $hasCatatanApp ? "COALESCE(i.Catatan_approver, '') as catatanApprover" : "'' as catatanApprover";
            $tglAppCol       = $hasTglApp ? "COALESCE(DATE_FORMAT(i.Tanggal_approval, '%Y-%m-%d'), '') as tanggalApproval" : "'' as tanggalApproval";
            $buktiCol        = $hasBukti ? "COALESCE(i.File_bukti, '') as fileBukti" : "'' as fileBukti";
            // Pengajuan ulang: izin lama yang ditolak beserta catatan penolakannya
            $sebelumnyaCol   = $hasSebelumnya ? "i.Id_izin_sebelumnya as idIzinSebelumnya, COALESCE(sebelumnya.Catatan_approver, '') as catatanSebelumnya" : "NULL as idIzinSebelumnya, '' as catatanSebelumnya";
            $joinSebelumnya  = $hasSebelumnya ? "LEFT JOIN izin sebelumnya ON sebelumnya.Id_izin = i.Id_izin_sebelumnya" : "";

            $approverCol     = $hasApprover ? "i.NIM_approver as nimApprover, approver.Nama as namaApprover" : "NULL as nimApprover, '' as namaApprover";
            $joinApprover    = $hasApprover ? "LEFT JOIN user approver ON BINARY approver.NIM = BINARY i.NIM_approver" : "";

            $hasUser   = $this->db->tableExists('user');
            $hasKamar  = $this->db->tableExists('kamar');
            $hasGedung = $this->db->tableExists('gedung');

            $namaPenghuniCol = $hasUser ? "u.Nama as namaPenghuni" : "'' as namaPenghuni";
            $nomorKamarCol   = ($hasUser && $hasKamar) ? "COALESCE(u.Nomor_kamar, '') as nomorKamar" : "'' as nomorKamar";
            $namaGedungCol   = ($hasKamar && $hasGedung) ? "COALESCE(g.Nama, '') as namaGedung" : "'' as namaGedung";

            $joinUser  = $hasUser ? "LEFT JOIN user u ON BINARY u.NIM = BINARY i.NIM" : "";
            $joinKamar = ($hasUser && $hasKamar) ? "LEFT JOIN kamar k ON BINARY k.Nomor_kamar = BINARY u.Nomor_kamar" : "";
            $joinGedung = ($hasKamar && $hasGedung) ? "LEFT JOIN gedung g ON g.Id_Gedung = k.Id_Gedung" : "";

            // Lingkup data mengikuti peran: penghuni = miliknya sendiri, fasil = penghuni gedung yang ia pegang,
            // admin = semua. Mencegah alasan izin & berkas bukti penghuni lain ikut terkirim ke browser.
            $token = $this->tokenUser();
            $binds = [];
            switch ($token['role'] ?? '') {
                case 'admin':
                    $where = '';
                    break;
                case 'fasil':
                    // Tanpa tabel gedung/kamar tidak bisa dipastikan gedungnya: jangan tampilkan apa pun
                    if (!($hasUser && $hasKamar && $hasGedung)) {
                        return $this->respond([]);
                    }
                    $where   = 'WHERE BINARY g.NIM_Pj = BINARY ?';
                    $binds[] = $token['nim'] ?? '';
                    break;
                case 'penghuni':
                    $where   = 'WHERE BINARY i.NIM = BINARY ?';
                    $binds[] = $token['nim'] ?? '';
                    break;
                default:
                    return $this->failForbidden('Akses data izin tidak diizinkan.');
            }

            $query = $this->db->query("
                SELECT
                    i.Id_izin as id,
                    i.NIM as nim,
                    {$namaPenghuniCol},
                    {$nomorKamarCol},
                    {$namaGedungCol},
                    {$approverCol},
                    i.Alasan as alasan,
                    i.Status_persetujuan as statusPersetujuan,
                    {$buktiCol},
                    i.Tanggal as tanggal,
                    {$tglSelesaiCol},
                    {$sesiCol},
                    {$hariBerulangCol},
                    {$catatanAppCol},
                    {$tglAppCol},
                    {$sebelumnyaCol}
                FROM izin i
                {$joinSebelumnya}
                {$joinUser}
                {$joinApprover}
                {$joinKamar}
                {$joinGedung}
                {$where}
                ORDER BY i.Tanggal DESC, i.Id_izin DESC
            ", $binds);

            $data = $query->getResultArray();
            foreach ($data as &$row) {
                $row['id'] = (int) $row['id'];
                $row['idIzinSebelumnya'] = $row['idIzinSebelumnya'] === null ? null : (int) $row['idIzinSebelumnya'];
                // Izin rutin: daftar hari ISO (1 = Senin … 7 = Minggu); null = setiap hari dalam rentang
                $row['hariBerulang'] = $row['hariBerulang'] === null ? null : array_map('intval', explode(',', $row['hariBerulang']));
            }
            return $this->respond($data);
        } catch (\Throwable $e) {
            return $this->respond([]);
        }
    }

    // ----------------------------------------------------
    // POST /api/izin
    // ----------------------------------------------------
    public function addIzin()
    {
        $token = $this->tokenUser();
        if (($token['role'] ?? '') !== 'penghuni') {
            return $this->failForbidden('Hanya penghuni yang dapat mengajukan izin.');
        }
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        // NIM dari token login, bukan dari body, agar tidak bisa mengajukan izin atas nama orang lain
        $nim = $token['nim'] ?? '';
        $alasan = trim($input['alasan'] ?? '');
        $sesi = ($input['sesi'] ?? null) ?: null;

        // Tanggal izin: satu rentang (tanggal–tanggalSelesai) atau beberapa tanggal terpisah (tanggalList).
        // Tanggal terpisah dikelompokkan menjadi rentang berurutan; tiap rentang = satu baris izin.
        if (isset($input['tanggalList'])) {
            $daftar = $input['tanggalList'];
            if (!is_array($daftar) || $daftar === []) {
                return $this->fail('Pilih minimal satu tanggal izin.', 400);
            }
            $daftar = array_values(array_unique(array_map('strval', $daftar)));
            if (count($daftar) > 31) {
                return $this->fail('Maksimal 31 tanggal dalam satu pengajuan.', 400);
            }
            foreach ($daftar as $t) {
                if (!$this->tanggalValid($t)) {
                    return $this->fail('Tanggal izin tidak valid.', 400);
                }
            }
            sort($daftar);
            $rentang = $this->kelompokkanTanggal($daftar);
        } else {
            $tanggal = $input['tanggal'] ?? '';
            $tanggalSelesai = ($input['tanggalSelesai'] ?? '') ?: $tanggal;
            if (!$this->tanggalValid($tanggal) || !$this->tanggalValid($tanggalSelesai)) {
                return $this->fail('Tanggal izin wajib diisi dengan benar.', 400);
            }
            if ($tanggalSelesai < $tanggal) {
                return $this->fail('Tanggal selesai tidak boleh sebelum tanggal mulai.', 400);
            }
            $rentang = [[$tanggal, $tanggalSelesai]];
        }

        // Berkas bukti opsional (data URL PDF/JPG/PNG, maks. 2 MB)
        $bukti = null;
        if (!empty($input['buktiFile'])) {
            $bukti = $this->dekodeBuktiIzin($input['buktiFile']);
            if ($bukti === null) {
                return $this->fail('Berkas bukti harus PDF, JPG, atau PNG dengan ukuran maksimal 2 MB.', 400);
            }
        }

        if (!$nim || !$alasan) {
            return $this->fail('Tanggal dan alasan izin wajib diisi.', 400);
        }
        if ($rentang[0][0] < date('Y-m-d')) {
            return $this->fail('Izin tidak dapat diajukan untuk tanggal yang sudah lewat.', 400);
        }
        if ($sesi !== null && !$this->presensiService->namaSesiDikenal($sesi)) {
            return $this->fail('Sesi tidak dikenal.', 400);
        }

        // Pengajuan ulang izin yang ditolak (opsional): izin lama tidak diubah, baris baru menunjuk ke sana
        // sehingga riwayat penolakan & catatan fasil tetap tersimpan
        $idSebelumnya = null;
        $buktiLama    = null;
        if (!empty($input['idIzinSebelumnya'])) {
            if (!$this->db->fieldExists('Id_izin_sebelumnya', 'izin')) {
                return $this->failServerError('Database belum diperbarui. Jalankan: php spark migrate');
            }
            $lama = $this->db->table('izin')->where('Id_izin', (int) $input['idIzinSebelumnya'])->get()->getRowArray();
            if (!$lama || $lama['NIM'] !== $nim) {
                return $this->failNotFound('Izin sebelumnya tidak ditemukan.');
            }
            if ($lama['Status_persetujuan'] !== 'Ditolak') {
                return $this->fail('Hanya izin yang ditolak yang dapat diajukan ulang.', 400);
            }
            if ($this->db->table('izin')->where('Id_izin_sebelumnya', $lama['Id_izin'])->countAllResults() > 0) {
                return $this->fail('Izin ini sudah pernah diajukan ulang.', 409);
            }
            $idSebelumnya = (int) $lama['Id_izin'];
            // Bukti lama boleh dipakai lagi bila penghuni tidak mengunggah bukti baru
            if ($bukti === null && !empty($input['pakaiBuktiLama']) && !empty($lama['File_bukti'])) {
                $buktiLama = $lama['File_bukti'];
            }
        }

        // Tolak pengajuan yang bertumpuk dengan izin pending/disetujui
        foreach ($rentang as [$dari, $sampai]) {
            if ($this->izinBentrok($nim, $dari, $sampai, $sesi)) {
                return $this->fail('Sudah ada pengajuan izin pada tanggal/sesi tersebut.', 409);
            }
        }

        // Simpan bukti di writable/ (tidak bisa diakses langsung dari URL publik), setelah semua validasi lolos
        $fileBukti = null;
        if ($bukti !== null) {
            $dir = WRITEPATH . 'uploads/izin/';
            if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
                return $this->failServerError('Folder penyimpanan bukti tidak dapat dibuat.');
            }
            $fileBukti = sprintf('izin_%s_%s_%s.%s', preg_replace('/[^A-Za-z0-9]/', '', $nim), date('Ymd'), bin2hex(random_bytes(4)), $bukti['ext']);
            if (file_put_contents($dir . $fileBukti, $bukti['data']) === false) {
                return $this->failServerError('Berkas bukti gagal disimpan.');
            }
        }

        // Semua rentang disimpan sekaligus: gagal satu = batal semua
        $this->db->transStart();
        foreach ($rentang as [$dari, $sampai]) {
            $baris = [
                'NIM'                => $nim,
                'Alasan'             => $alasan,
                'Status_persetujuan' => 'Pending',
                'File_bukti'         => $fileBukti ?? $buktiLama,
                'Tanggal'            => $dari,
                'Tanggal_selesai'    => $sampai,
                'Sesi'               => $sesi,
                'created_at'         => date('Y-m-d H:i:s'),
                'updated_at'         => date('Y-m-d H:i:s'),
            ];
            if ($idSebelumnya !== null) {
                $baris['Id_izin_sebelumnya'] = $idSebelumnya;
            }
            $this->db->table('izin')->insert($baris);
        }
        $this->db->transComplete();
        if (!$this->db->transStatus()) {
            // Hanya berkas yang baru diunggah yang dihapus; bukti lama masih dipakai izin sebelumnya
            if ($fileBukti !== null) {
                @unlink(WRITEPATH . 'uploads/izin/' . $fileBukti);
            }
            return $this->failServerError('Pengajuan izin gagal disimpan.');
        }

        $pesan = count($rentang) === 1 ? 'Pengajuan izin berhasil dikirim' : count($rentang) . ' pengajuan izin berhasil dikirim';
        return $this->respondCreated(['status' => 'success', 'message' => $pesan]);
    }

    // ----------------------------------------------------
    // POST /api/izin/batal
    // Penghuni membatalkan izinnya sendiri yang belum diputuskan. Izin yang belum diputuskan
    // belum memiliki keputusan fasil yang perlu dijaga, jadi barisnya dihapus.
    // ----------------------------------------------------
    public function batalIzin()
    {
        $token = $this->tokenUser();
        if (($token['role'] ?? '') !== 'penghuni') {
            return $this->failForbidden('Hanya penghuni yang dapat membatalkan izin.');
        }
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $id = (int) ($input['id'] ?? 0);

        $izin = $this->db->table('izin')->where('Id_izin', $id)->get()->getRowArray();
        // Izin milik orang lain dijawab "tidak ditemukan" agar keberadaannya tidak terungkap
        if (!$izin || $izin['NIM'] !== ($token['nim'] ?? '')) {
            return $this->failNotFound('Pengajuan izin tidak ditemukan.');
        }
        if ($izin['Status_persetujuan'] !== 'Pending') {
            return $this->fail('Izin yang sudah diputuskan fasilitator tidak dapat dibatalkan.', 409);
        }

        $this->db->table('izin')->where('Id_izin', $id)->delete();

        // Hapus berkas bukti bila tidak dipakai izin lain (bukti bisa dipakai bersama oleh pengajuan ulang
        // atau oleh beberapa rentang dari satu pengajuan)
        $berkas = $izin['File_bukti'] ?? '';
        if ($berkas !== '' && $this->db->table('izin')->where('File_bukti', $berkas)->countAllResults() === 0) {
            @unlink(WRITEPATH . 'uploads/izin/' . basename($berkas));
        }

        return $this->respond(['status' => 'success', 'message' => 'Pengajuan izin dibatalkan']);
    }

    private function tanggalValid($tanggal): bool
    {
        return is_string($tanggal) && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $tanggal, $m) === 1 && checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
    }

    /** Kelompokkan tanggal terurut menjadi rentang berurutan, mis. 1,2,3,5 Des → [1–3 Des], [5–5 Des] */
    private function kelompokkanTanggal(array $tanggal): array
    {
        $hasil = [];
        foreach ($tanggal as $t) {
            $akhir = count($hasil) - 1;
            if ($akhir >= 0 && date('Y-m-d', strtotime($hasil[$akhir][1] . ' +1 day')) === $t) {
                $hasil[$akhir][1] = $t;
            } else {
                $hasil[] = [$t, $t];
            }
        }

        return $hasil;
    }

    /** Ada izin pending/disetujui milik $nim yang mencakup salah satu tanggal di [$dari, $sampai] untuk sesi tersebut */
    private function izinBentrok(string $nim, string $dari, string $sampai, ?string $sesi): bool
    {
        $query = $this->db->table('izin')
            ->where('NIM', $nim)
            ->where('Status_persetujuan !=', 'Ditolak')
            ->where('Tanggal <=', $sampai)
            ->where('COALESCE(Tanggal_selesai, Tanggal) >= ' . $this->db->escape($dari), null, false);
        if ($sesi !== null) {
            $query->groupStart()->where('Sesi', null)->orWhere('Sesi', $sesi)->groupEnd();
        }
        foreach ($query->get()->getResultArray() as $lama) {
            // Izin rutin lama hanya berlaku pada hari tertentu dalam rentangnya
            $hariLama = empty($lama['Hari_berulang']) ? range(1, 7) : array_map('intval', explode(',', $lama['Hari_berulang']));
            $irisanDari   = max($dari, $lama['Tanggal']);
            $irisanSampai = min($sampai, $lama['Tanggal_selesai'] ?? $lama['Tanggal']);
            if ($this->adaHariDalamRentang($irisanDari, $irisanSampai, $hariLama)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Dekode data URL berkas bukti izin; null jika bukan PDF/JPEG/PNG yang valid atau melebihi 2 MB
     *
     * @return array{data: string, ext: string}|null
     */
    private function dekodeBuktiIzin($dataUrl): ?array
    {
        if (!is_string($dataUrl) || !preg_match('#^data:[a-z/+.-]*;base64,#i', $dataUrl, $m)) {
            return null;
        }
        $data = base64_decode(substr($dataUrl, strlen($m[0])), true);
        if ($data === false || $data === '' || strlen($data) > 2 * 1024 * 1024) {
            return null;
        }
        // Jenis berkas dari isinya, bukan dari label data URL / nama berkas
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime  = finfo_buffer($finfo, $data);
        finfo_close($finfo);
        $ext = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'][$mime] ?? null;

        return $ext === null ? null : ['data' => $data, 'ext' => $ext];
    }

    // ----------------------------------------------------
    // GET /api/izin/bukti/{nama}
    // ----------------------------------------------------
    public function buktiIzin(string $nama)
    {
        // Hanya nama berkas yang dibuat addIzin; mencegah akses ke berkas lain (path traversal)
        if (!preg_match('/^izin_[A-Za-z0-9_]+\.(pdf|jpg|png)$/', $nama, $m)) {
            return $this->failNotFound('Bukti izin tidak ditemukan.');
        }
        $path = WRITEPATH . 'uploads/izin/' . $nama;
        if (!is_file($path)) {
            return $this->failNotFound('Bukti izin tidak ditemukan.');
        }

        // Hanya pemilik, fasil PJ gedungnya, dan admin; selain itu 404 agar keberadaan berkas tidak terungkap
        $token   = $this->tokenUser();
        $pemilik = $this->db->table('izin')->select('NIM')->where('File_bukti', $nama)->get()->getRowArray();
        $boleh = $pemilik && match ($token['role'] ?? '') {
            'admin'    => true,
            'penghuni' => $pemilik['NIM'] === ($token['nim'] ?? ''),
            'fasil'    => $this->adalahPjPenghuni($token['nim'] ?? '', $pemilik['NIM']),
            default    => false,
        };
        if (!$boleh) {
            return $this->failNotFound('Bukti izin tidak ditemukan.');
        }

        $mime = ['pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'png' => 'image/png'][$m[1]];

        // Charset kosong: berkas biner (PDF/gambar) tidak punya charset
        return $this->response
            ->setContentType($mime, '')
            ->setHeader('Content-Disposition', 'inline; filename="' . $nama . '"')
            ->setHeader('Cache-Control', 'private, max-age=86400')
            ->setBody(file_get_contents($path));
    }

    /** Ada tanggal di [$dari, $sampai] yang jatuh pada salah satu hari ISO di $hari */
    private function adaHariDalamRentang(string $dari, string $sampai, array $hari): bool
    {
        for ($t = $dari, $n = 0; $t <= $sampai && $n < 7; $t = date('Y-m-d', strtotime($t . ' +1 day')), $n++) {
            if (in_array((int) date('N', strtotime($t)), $hari, true)) {
                return true;
            }
        }

        return false;
    }

    // ----------------------------------------------------
    // POST /api/izin/status
    // Hanya fasil PJ gedung penghuni; penolakan wajib disertai catatan
    // ----------------------------------------------------
    public function updateIzinStatus()
    {
        $token = $this->tokenUser();
        if (($token['role'] ?? '') !== 'fasil') {
            return $this->failForbidden('Hanya fasil yang dapat memutuskan izin.');
        }
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $id = $input['id'] ?? 0;
        $status = $input['status'] ?? ''; // 'Disetujui' or 'Ditolak'
        // NIM approver dari token login, bukan dari body, agar tidak bisa memutuskan izin gedung lain
        $approverNim = $token['nim'] ?? '';
        $catatan = trim($input['catatan'] ?? '');

        if (!$id || !in_array($status, ['Disetujui', 'Ditolak'], true)) {
            return $this->fail('ID izin dan status persetujuan wajib diisi.', 400);
        }
        if ($status === 'Ditolak' && $catatan === '') {
            return $this->fail('Alasan penolakan wajib diisi.', 400);
        }

        $izin = $this->db->table('izin')->where('Id_izin', $id)->get()->getRowArray();
        if (!$izin) {
            return $this->failNotFound('Pengajuan izin tidak ditemukan.');
        }
        if ($izin['Status_persetujuan'] !== 'Pending') {
            return $this->fail('Pengajuan izin ini sudah diputuskan.', 409);
        }
        if (!$this->adalahPjPenghuni($approverNim, $izin['NIM'])) {
            return $this->fail('Hanya fasil PJ gedung penghuni ini yang dapat memutuskan izin.', 403);
        }

        $this->db->table('izin')->where('Id_izin', $id)->update([
            'Status_persetujuan' => $status,
            'NIM_approver'       => $approverNim,
            'Catatan_approver'   => $catatan !== '' ? $catatan : null,
            'Tanggal_approval'   => date('Y-m-d H:i:s'),
            'updated_at'         => date('Y-m-d H:i:s'),
        ]);

        return $this->respond(['status' => 'success', 'message' => 'Status izin berhasil diperbarui']);
    }

    // ----------------------------------------------------
    // GET or POST /api/seed
    // Jalankan seeder untuk mengisi database framework dengan data awal
    // ----------------------------------------------------
    public function runSeeder()
    {
        try {
            $seeder = new \App\Database\Seeds\AsramaSeeder();
            $seeder->run();

            return $this->respond([
                'status'  => 'success',
                'message' => 'Seeder berhasil dijalankan! Database framework kini telah terisi data.',
            ]);
        } catch (\Throwable $e) {
            return $this->failServerError('Gagal menjalankan seeder: ' . $e->getMessage());
        }
    }
}
