<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Models\PengaturanModel;
use CodeIgniter\API\ResponseTrait;

class DataController extends BaseController
{
    use ResponseTrait;

    protected $db;

    public function __construct()
    {
        $this->db = \Config\Database::connect();
    }

    // ----------------------------------------------------
    // GET /api/gedung
    // ----------------------------------------------------
    public function getGedung()
    {
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
            LEFT JOIN user u ON u.NIM = g.NIM_Pj
            ORDER BY g.Id_Gedung ASC
        ");

        $data = $query->getResultArray();
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

    // ----------------------------------------------------
    // POST /api/gedung/update
    // Mengatur titik koordinat & radius geofence gedung
    // ----------------------------------------------------
    public function updateGedung()
    {
        $input  = $this->request->getJSON(true) ?? $this->request->getPost();
        $id     = (int) ($input['id'] ?? 0);
        $lat    = $input['latitude'] ?? null;
        $lng    = $input['longitude'] ?? null;
        $radius = (int) ($input['radiusMeter'] ?? 0);

        if (! $id || $radius < 1) {
            return $this->fail('ID gedung dan radius (minimal 1 meter) wajib diisi.', 400);
        }
        if (($lat === null) !== ($lng === null)) {
            return $this->fail('Latitude dan Longitude harus diisi keduanya.', 400);
        }
        if ($lat !== null && (! is_numeric($lat) || $lat < -90 || $lat > 90 || ! is_numeric($lng) || $lng < -180 || $lng > 180)) {
            return $this->fail('Koordinat tidak valid.', 400);
        }

        $exists = $this->db->table('gedung')->where('Id_Gedung', $id)->countAllResults();
        if (! $exists) {
            return $this->failNotFound('Gedung tidak ditemukan.');
        }

        $this->db->table('gedung')->where('Id_Gedung', $id)->update([
            'Latitude'     => $lat,
            'Longitude'    => $lng,
            'Radius_meter' => $radius,
            'updated_at'   => date('Y-m-d H:i:s'),
        ]);

        return $this->respond(['status' => 'success', 'message' => 'Lokasi gedung berhasil diperbarui']);
    }

    // ----------------------------------------------------
    // POST /api/gedung/pj
    // Menetapkan fasil penanggung jawab gedung (satu fasil = satu gedung)
    // ----------------------------------------------------
    public function setPjGedung()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $id    = (int) ($input['id'] ?? 0);
        $nimPj = $input['nimPj'] ?? null;

        if (! $this->db->table('gedung')->where('Id_Gedung', $id)->countAllResults()) {
            return $this->failNotFound('Gedung tidak ditemukan.');
        }

        if ($nimPj !== null) {
            $fasil = $this->db->table('user')->where('NIM', $nimPj)->get()->getRowArray();
            if (! $fasil || strtolower($fasil['Role']) !== 'fasil' || $fasil['Status_aktif'] !== 'Aktif') {
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
        $query = $this->db->query("
            SELECT
                k.Nomor_kamar as nomorKamar,
                k.Lantai as lantai,
                k.Kapasitas as kapasitas,
                k.Id_Gedung as idGedung,
                g.Nama as namaGedung,
                (SELECT COUNT(*) FROM user u WHERE u.Nomor_kamar = k.Nomor_kamar AND u.Status_aktif = 'Aktif') as penghuniCount
            FROM kamar k
            LEFT JOIN gedung g ON g.Id_Gedung = k.Id_Gedung
            ORDER BY k.Nomor_kamar ASC
        ");

        $data = $query->getResultArray();
        foreach ($data as &$row) {
            $row['lantai']        = (int) $row['lantai'];
            $row['kapasitas']     = (int) $row['kapasitas'];
            $row['idGedung']      = (int) $row['idGedung'];
            $row['penghuniCount'] = (int) $row['penghuniCount'];
        }
        return $this->respond($data);
    }

    // ----------------------------------------------------
    // GET /api/penghuni
    // ----------------------------------------------------
    public function getPenghuni()
    {
        $query = $this->db->query("
            SELECT
                u.NIM as nim,
                u.Nama as nama,
                COALESCE(u.Nomor_kamar, '') as nomorKamar,
                COALESCE(g.Nama, '') as namaGedung,
                u.Asal as asal,
                u.Email as email,
                u.No_HP as noHp,
                u.Password as passwordHash,
                (u.Status_aktif = 'Aktif') as statusAktif,
                LOWER(u.Role) as role,
                COALESCE(DATE(u.created_at), '') as tanggalMasuk
            FROM user u
            LEFT JOIN kamar k ON k.Nomor_kamar = u.Nomor_kamar
            LEFT JOIN gedung g ON g.Id_Gedung = k.Id_Gedung
            WHERE LOWER(u.Role) <> 'admin'
            ORDER BY u.Nama ASC
        ");

        $data = $query->getResultArray();
        // Convert statusAktif to boolean and normalize roles
        foreach ($data as &$row) {
            $row['statusAktif'] = (bool)$row['statusAktif'];
            if ($row['role'] === 'mahasiswa') {
                $row['role'] = 'penghuni';
            }
            $row['passwordDefault'] = $row['role'] === 'penghuni' && password_verify('penghuni123', $row['passwordHash']);
            unset($row['passwordHash']);
        }
        return $this->respond($data);
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
        $query = $this->db->query("
            SELECT
                p.Id_presensi as id,
                p.NIM as nim,
                u.Nama as namaPenghuni,
                COALESCE(u.Nomor_kamar, '') as nomorKamar,
                COALESCE(g.Nama, '') as namaGedung,
                p.Tanggal as tanggal,
                p.Sesi as sesi,
                COALESCE(DATE_FORMAT(p.Waktu, '%H:%i'), '') as waktu,
                p.Latitude as latitude,
                p.Longitude as longitude,
                p.Status as status,
                COALESCE(p.Foto_wajah, '') as fotoWajah,
                COALESCE(p.Keterangan, '') as keterangan,
                p.Dikoreksi_oleh as dikoreksiOleh
            FROM presensi p
            LEFT JOIN user u ON u.NIM = p.NIM
            LEFT JOIN kamar k ON k.Nomor_kamar = u.Nomor_kamar
            LEFT JOIN gedung g ON g.Id_Gedung = k.Id_Gedung
            ORDER BY p.Tanggal DESC, p.Id_presensi DESC
        ");

        $data = $query->getResultArray();
        foreach ($data as &$row) {
            $row['id']        = (int) $row['id'];
            $row['latitude']  = $row['latitude'] !== null ? (float) $row['latitude'] : null;
            $row['longitude'] = $row['longitude'] !== null ? (float) $row['longitude'] : null;
        }
        return $this->respond($data);
    }

    private function cariLibur(string $tanggal): ?array
    {
        return $this->db->table('hari_libur')
            ->where('Tanggal_mulai <=', $tanggal)
            ->where('Tanggal_selesai >=', $tanggal)
            ->get()->getRowArray();
    }

    private function cariIzinDisetujui(string $nim, string $tanggal, string $sesi): ?array
    {
        return $this->db->table('izin')
            ->where('NIM', $nim)
            ->where('Status_persetujuan', 'Disetujui')
            ->where('Tanggal <=', $tanggal)
            ->where('COALESCE(Tanggal_selesai, Tanggal) >= ' . $this->db->escape($tanggal), null, false)
            ->groupStart()->where('Sesi', null)->orWhere('Sesi', $sesi)->groupEnd()
            ->get()->getRowArray();
    }

    // ----------------------------------------------------
    // POST /api/presensi
    // Presensi mandiri: sesi harus sedang dibuka, bukan libur, tidak sedang izin, dan dalam radius gedung
    // ----------------------------------------------------
    public function checkIn()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $nim = $input['nim'] ?? '';
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

        $dataSesi = $this->db->table('sesi')->where('Nama', $sesi)->where('Aktif', 1)->get()->getRowArray();
        if (!$dataSesi) {
            return $this->fail('Sesi ' . $sesi . ' tidak tersedia.', 400);
        }
        if (!$modeUji['abaikanJam'] && ($jam < $dataSesi['Jam_mulai'] || $jam > $dataSesi['Jam_selesai'])) {
            return $this->fail(sprintf(
                'Presensi sesi %s hanya dibuka pukul %s–%s WIB.',
                $sesi, substr($dataSesi['Jam_mulai'], 0, 5), substr($dataSesi['Jam_selesai'], 0, 5)
            ), 403);
        }
        if ($libur = $this->cariLibur($tanggal)) {
            return $this->fail('Hari ini libur (' . $libur['Keterangan'] . '), tidak ada kewajiban presensi.', 400);
        }
        if ($this->cariIzinDisetujui($nim, $tanggal, $sesi)) {
            return $this->fail('Anda berstatus izin pada sesi ini.', 400);
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
            'Status'     => 'Hadir',
            'Foto_wajah' => $namaFoto,
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
        $input       = $this->request->getJSON(true) ?? $this->request->getPost();
        $nim         = $input['nim'] ?? '';
        $tanggal     = $input['tanggal'] ?? '';
        $sesi        = $input['sesi'] ?? '';
        $status      = $input['status'] ?? '';
        $keterangan  = trim($input['keterangan'] ?? '');
        $korektorNim = $input['korektorNim'] ?? '';

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
                'NIM'        => $nim,
                'Tanggal'    => $tanggal,
                'Sesi'       => $sesi,
                'Waktu'      => date('Y-m-d H:i:s'),
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        }

        return $this->respond(['status' => 'success', 'message' => 'Presensi berhasil dikoreksi']);
    }

    // ----------------------------------------------------
    // GET /api/izin
    // ----------------------------------------------------
    public function getIzin()
    {
        $query = $this->db->query("
            SELECT
                i.Id_izin as id,
                i.NIM as nim,
                u.Nama as namaPenghuni,
                COALESCE(u.Nomor_kamar, '') as nomorKamar,
                COALESCE(g.Nama, '') as namaGedung,
                i.NIM_approver as nimApprover,
                approver.Nama as namaApprover,
                i.Alasan as alasan,
                i.Status_persetujuan as statusPersetujuan,
                COALESCE(i.File_bukti, '') as fileBukti,
                i.Tanggal as tanggal,
                COALESCE(i.Tanggal_selesai, i.Tanggal) as tanggalSelesai,
                i.Sesi as sesi,
                COALESCE(i.Catatan_approver, '') as catatanApprover,
                COALESCE(DATE_FORMAT(i.Tanggal_approval, '%Y-%m-%d'), '') as tanggalApproval
            FROM izin i
            LEFT JOIN user u ON u.NIM = i.NIM
            LEFT JOIN user approver ON approver.NIM = i.NIM_approver
            LEFT JOIN kamar k ON k.Nomor_kamar = u.Nomor_kamar
            LEFT JOIN gedung g ON g.Id_Gedung = k.Id_Gedung
            ORDER BY i.Tanggal DESC, i.Id_izin DESC
        ");

        $data = $query->getResultArray();
        foreach ($data as &$row) {
            $row['id'] = (int) $row['id'];
        }
        return $this->respond($data);
    }

    // ----------------------------------------------------
    // POST /api/izin
    // ----------------------------------------------------
    public function addIzin()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $nim = $input['nim'] ?? '';
        $alasan = trim($input['alasan'] ?? '');
        $tanggal = $input['tanggal'] ?? '';
        $tanggalSelesai = $input['tanggalSelesai'] ?? $tanggal;
        $sesi = $input['sesi'] ?? null;
        $fileBukti = $input['fileBukti'] ?? '';

        if (!$nim || !$alasan || !$tanggal) {
            return $this->fail('NIM, tanggal, dan alasan izin wajib diisi.', 400);
        }
        if ($tanggal < date('Y-m-d')) {
            return $this->fail('Izin tidak dapat diajukan untuk tanggal yang sudah lewat.', 400);
        }
        if ($tanggalSelesai < $tanggal) {
            return $this->fail('Tanggal selesai tidak boleh sebelum tanggal mulai.', 400);
        }
        if ($sesi !== null && !$this->db->table('sesi')->where('Nama', $sesi)->countAllResults()) {
            return $this->fail('Sesi tidak dikenal.', 400);
        }

        // Tolak pengajuan yang bertumpuk dengan izin pending/disetujui
        $bentrok = $this->db->table('izin')
            ->where('NIM', $nim)
            ->where('Status_persetujuan !=', 'Ditolak')
            ->where('Tanggal <=', $tanggalSelesai)
            ->where('COALESCE(Tanggal_selesai, Tanggal) >= ' . $this->db->escape($tanggal), null, false);
        if ($sesi !== null) {
            $bentrok->groupStart()->where('Sesi', null)->orWhere('Sesi', $sesi)->groupEnd();
        }
        if ($bentrok->countAllResults()) {
            return $this->fail('Sudah ada pengajuan izin pada tanggal/sesi tersebut.', 409);
        }

        $this->db->table('izin')->insert([
            'NIM'                => $nim,
            'Alasan'             => $alasan,
            'Status_persetujuan' => 'Pending',
            'File_bukti'         => $fileBukti,
            'Tanggal'            => $tanggal,
            'Tanggal_selesai'    => $tanggalSelesai,
            'Sesi'               => $sesi,
            'created_at'         => date('Y-m-d H:i:s'),
            'updated_at'         => date('Y-m-d H:i:s'),
        ]);

        return $this->respondCreated(['status' => 'success', 'message' => 'Pengajuan izin berhasil dikirim']);
    }

    // ----------------------------------------------------
    // POST /api/izin/status
    // Hanya fasil PJ gedung penghuni; penolakan wajib disertai catatan
    // ----------------------------------------------------
    public function updateIzinStatus()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $id = $input['id'] ?? 0;
        $status = $input['status'] ?? ''; // 'Disetujui' or 'Ditolak'
        $approverNim = $input['approverNim'] ?? '';
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
}
