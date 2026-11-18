<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\EventService;
use App\Models\EventModel;
use App\Models\PresensiEventModel;
use CodeIgniter\API\ResponseTrait;

class EventController extends BaseController
{
    use ResponseTrait;

    protected $db;
    protected EventService $eventService;

    public function __construct()
    {
        $this->db           = \Config\Database::connect();
        $this->eventService = new EventService($this->db);
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

    private function gedungBinaanFasil(string $nimFasil): ?int
    {
        $row = $this->db->table('gedung')->where('NIM_Pj', $nimFasil)->get()->getRowArray();
        return $row ? (int) $row['Id_Gedung'] : null;
    }

    private function gedungPenghuni(string $nimPenghuni): ?int
    {
        $row = $this->db->query("
            SELECT k.Id_Gedung
            FROM user u
            JOIN kamar k ON BINARY k.Nomor_kamar = BINARY u.Nomor_kamar
            WHERE u.NIM = ?
            LIMIT 1
        ", [$nimPenghuni])->getRowArray();
        return $row ? (int) $row['Id_Gedung'] : null;
    }

    // ----------------------------------------------------
    // GET /api/event
    // Mengambil daftar event sesuai hak akses pengguna
    // ----------------------------------------------------
    public function getEvent()
    {
        $user = $this->tokenUser();
        if (empty($user)) {
            return $this->failUnauthorized('Autentikasi diperlukan.');
        }

        $events = $this->eventService->ambilDaftarEvent($user);
        return $this->respond($events);
    }

    // ----------------------------------------------------
    // POST /api/event/add
    // Admin: buat event seluruh asrama atau event gedung
    // Fasil: buat event gedung (hanya untuk gedung binaannya)
    // ----------------------------------------------------
    public function addEvent()
    {
        $user = $this->tokenUser();
        $role = strtolower($user['role'] ?? '');
        $nim  = $user['nim'] ?? '';

        if (! in_array($role, ['admin', 'fasil'], true)) {
            return $this->failForbidden('Hanya Admin dan Fasil yang dapat membuat event.');
        }

        $input       = $this->request->getJSON(true) ?? $this->request->getPost();
        $judul       = trim($input['judul'] ?? '');
        $deskripsi   = trim($input['deskripsi'] ?? '') ?: null;
        $tipe        = $input['tipe'] ?? 'seluruh';
        $idGedung    = isset($input['idGedung']) && $input['idGedung'] !== '' ? (int) $input['idGedung'] : null;
        $tanggal     = trim($input['tanggal'] ?? '');
        $jamMulai    = trim($input['jamMulai'] ?? '');
        $jamSelesai  = trim($input['jamSelesai'] ?? '');
        $lokasi      = trim($input['lokasi'] ?? '');
        $latitude    = isset($input['latitude']) && $input['latitude'] !== '' ? (float) $input['latitude'] : null;
        $longitude   = isset($input['longitude']) && $input['longitude'] !== '' ? (float) $input['longitude'] : null;
        $radiusMeter = (int) ($input['radiusMeter'] ?? 50);

        if ($judul === '' || $tanggal === '' || $jamMulai === '' || $jamSelesai === '' || $lokasi === '') {
            return $this->fail('Judul, tanggal, jam mulai, jam selesai, dan nama lokasi wajib diisi.', 400);
        }

        if ($radiusMeter < 1) {
            return $this->fail('Radius geofence minimal 1 meter.', 400);
        }

        // Aturan hak akses tipe event:
        if ($role === 'fasil') {
            $idGedungBinaan = $this->gedungBinaanFasil($nim);
            if (! $idGedungBinaan) {
                return $this->fail('Anda belum ditunjuk sebagai PJ gedung manapun. Hubungi Admin.', 403);
            }
            // Fasil HANYA bisa membuat event per gedung untuk gedung binaannya
            $tipe     = 'gedung';
            $idGedung = $idGedungBinaan;
        } else {
            // Admin
            if ($tipe === 'gedung') {
                if (! $idGedung) {
                    return $this->fail('Untuk event per gedung, gedung wajib dipilih.', 400);
                }
                $exists = $this->db->table('gedung')->where('Id_Gedung', $idGedung)->countAllResults();
                if (! $exists) {
                    return $this->fail('Gedung yang dipilih tidak ditemukan.', 404);
                }
            } else {
                $tipe     = 'seluruh';
                $idGedung = null;
            }
        }

        // Foto sampul (opsional): data URL gambar dari form
        $sampul = null;
        if (! empty($input['fotoSampul'])) {
            $sampul = $this->simpanSampul((string) $input['fotoSampul']);
            if ($sampul === null) {
                return $this->fail('Foto sampul harus gambar JPG, PNG, atau WEBP dengan ukuran maksimal 3 MB.', 400);
            }
        }

        $eventModel = new EventModel();
        try {
        $idBaru = $eventModel->insert([
            'judul'        => $judul,
            'deskripsi'    => $deskripsi,
            'tipe'         => $tipe,
            'id_gedung'    => $idGedung,
            'tanggal'      => $tanggal,
            'jam_mulai'    => $jamMulai,
            'jam_selesai'  => $jamSelesai,
            'lokasi'       => $lokasi,
            'latitude'     => $latitude,
            'longitude'    => $longitude,
            'radius_meter' => $radiusMeter,
            'foto_sampul'  => $sampul,
            'created_by'   => $nim,
        ]);
        } catch (\Throwable $e) {
            // Simpan gagal: jangan tinggalkan berkas sampul yatim
            if ($sampul) {
                $this->hapusBerkasSampul($sampul);
            }
            throw $e;
        }

        return $this->respondCreated([
            'status'  => 'success',
            'message' => 'Event berhasil dibuat.',
            'id'      => $idBaru,
        ]);
    }

    // ----------------------------------------------------
    // POST /api/event/update
    // ----------------------------------------------------
    public function updateEvent()
    {
        $user = $this->tokenUser();
        $role = strtolower($user['role'] ?? '');
        $nim  = $user['nim'] ?? '';

        if (! in_array($role, ['admin', 'fasil'], true)) {
            return $this->failForbidden('Hanya Admin dan Fasil yang dapat mengedit event.');
        }

        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $id    = (int) ($input['id'] ?? 0);

        $event = $this->db->table('event')->where('id', $id)->get()->getRowArray();
        if (! $event) {
            return $this->failNotFound('Event tidak ditemukan.');
        }

        // Fasil hanya boleh edit event gedung binaannya
        if ($role === 'fasil') {
            $idGedungBinaan = $this->gedungBinaanFasil($nim);
            if ($event['tipe'] !== 'gedung' || (int) $event['id_gedung'] !== $idGedungBinaan) {
                return $this->failForbidden('Anda hanya dapat mengedit event gedung binaan Anda.');
            }
        }

        $judul       = trim($input['judul'] ?? $event['judul']);
        $deskripsi   = isset($input['deskripsi']) ? (trim($input['deskripsi']) ?: null) : $event['deskripsi'];
        $tanggal     = trim($input['tanggal'] ?? $event['tanggal']);
        $jamMulai    = trim($input['jamMulai'] ?? $event['jam_mulai']);
        $jamSelesai  = trim($input['jamSelesai'] ?? $event['jam_selesai']);
        $lokasi      = trim($input['lokasi'] ?? $event['lokasi']);
        $latitude    = isset($input['latitude']) && $input['latitude'] !== '' ? (float) $input['latitude'] : ($event['latitude'] !== null ? (float) $event['latitude'] : null);
        $longitude   = isset($input['longitude']) && $input['longitude'] !== '' ? (float) $input['longitude'] : ($event['longitude'] !== null ? (float) $event['longitude'] : null);
        $radiusMeter = isset($input['radiusMeter']) ? (int) $input['radiusMeter'] : (int) $event['radius_meter'];

        $updateData = [
            'judul'        => $judul,
            'deskripsi'    => $deskripsi,
            'tanggal'      => $tanggal,
            'jam_mulai'    => $jamMulai,
            'jam_selesai'  => $jamSelesai,
            'lokasi'       => $lokasi,
            'latitude'     => $latitude,
            'longitude'    => $longitude,
            'radius_meter' => $radiusMeter,
            'updated_at'   => date('Y-m-d H:i:s'),
        ];

        // Admin boleh mengubah tipe dan gedung
        if ($role === 'admin' && isset($input['tipe'])) {
            $tipe = $input['tipe'];
            $idGedung = isset($input['idGedung']) && $input['idGedung'] !== '' ? (int) $input['idGedung'] : null;
            if ($tipe === 'gedung' && ! $idGedung) {
                return $this->fail('Untuk event per gedung, gedung wajib dipilih.', 400);
            }
            $updateData['tipe']      = $tipe;
            $updateData['id_gedung'] = $tipe === 'gedung' ? $idGedung : null;
        }

        // Foto sampul: data URL baru = ganti, hapusSampul = hapus, tidak dikirim = tetap
        $sampulLama = $event['foto_sampul'] ?? null;
        if (! empty($input['fotoSampul']) && str_starts_with((string) $input['fotoSampul'], 'data:')) {
            $sampulBaru = $this->simpanSampul((string) $input['fotoSampul']);
            if ($sampulBaru === null) {
                return $this->fail('Foto sampul harus gambar JPG, PNG, atau WEBP dengan ukuran maksimal 3 MB.', 400);
            }
            $updateData['foto_sampul'] = $sampulBaru;
        } elseif (! empty($input['hapusSampul'])) {
            $updateData['foto_sampul'] = null;
        }

        $this->db->table('event')->where('id', $id)->update($updateData);

        // Berkas lama dihapus setelah data tersimpan
        if ($sampulLama && array_key_exists('foto_sampul', $updateData) && $updateData['foto_sampul'] !== $sampulLama) {
            $this->hapusBerkasSampul($sampulLama);
        }

        return $this->respond([
            'status'  => 'success',
            'message' => 'Event berhasil diperbarui.',
        ]);
    }

    // ----------------------------------------------------
    // POST /api/event/delete
    // ----------------------------------------------------
    public function deleteEvent()
    {
        $user = $this->tokenUser();
        $role = strtolower($user['role'] ?? '');
        $nim  = $user['nim'] ?? '';

        if (! in_array($role, ['admin', 'fasil'], true)) {
            return $this->failForbidden('Hanya Admin dan Fasil yang dapat menghapus event.');
        }

        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $id    = (int) ($input['id'] ?? 0);

        $event = $this->db->table('event')->where('id', $id)->get()->getRowArray();
        if (! $event) {
            return $this->failNotFound('Event tidak ditemukan.');
        }

        if ($role === 'fasil') {
            $idGedungBinaan = $this->gedungBinaanFasil($nim);
            if ($event['tipe'] !== 'gedung' || (int) $event['id_gedung'] !== $idGedungBinaan) {
                return $this->failForbidden('Anda hanya dapat menghapus event gedung binaan Anda.');
            }
        }

        // Hapus presensi event dan event terkait
        $this->db->table('presensi_event')->where('id_event', $id)->delete();
        $this->db->table('event')->where('id', $id)->delete();
        if (! empty($event['foto_sampul'])) {
            $this->hapusBerkasSampul($event['foto_sampul']);
        }

        return $this->respond([
            'status'  => 'success',
            'message' => 'Event berhasil dihapus.',
        ]);
    }

    // ----------------------------------------------------
    // GET /api/event/rekap/(:num)
    // ----------------------------------------------------
    public function rekapEvent(int $idEvent)
    {
        $user = $this->tokenUser();
        if (empty($user)) {
            return $this->failUnauthorized('Autentikasi diperlukan.');
        }

        $rekap = $this->eventService->ambilRekapEvent($idEvent, $user);
        if ($rekap === null) {
            return $this->failNotFound('Data rekap event tidak ditemukan atau Anda tidak memiliki akses.');
        }

        return $this->respond($rekap);
    }

    // ----------------------------------------------------
    // POST /api/event/absen
    // Absensi event oleh Penghuni dengan validasi waktu, radius, & foto wajah
    // ----------------------------------------------------
    public function absenEvent()
    {
        $user = $this->tokenUser();
        $role = strtolower($user['role'] ?? '');
        $nim  = $user['nim'] ?? '';

        if ($role !== 'penghuni') {
            return $this->failForbidden('Presensi event hanya dapat dilakukan oleh akun Penghuni.');
        }

        $input     = $this->request->getJSON(true) ?? $this->request->getPost();
        $idEvent   = (int) ($input['idEvent'] ?? 0);
        $lat       = isset($input['latitude']) && $input['latitude'] !== '' ? (float) $input['latitude'] : null;
        $lng       = isset($input['longitude']) && $input['longitude'] !== '' ? (float) $input['longitude'] : null;
        $fotoData  = $input['foto'] ?? '';

        if (! $idEvent) {
            return $this->fail('ID event wajib disertakan.', 400);
        }

        $event = $this->db->table('event')->where('id', $idEvent)->get()->getRowArray();
        if (! $event) {
            return $this->failNotFound('Event tidak ditemukan.');
        }

        // Validasi kepesertaan: jika event gedung, periksa apakah penghuni tinggal di gedung tersebut
        if ($event['tipe'] === 'gedung') {
            $idGedungPenghuni = $this->gedungPenghuni($nim);
            if ($idGedungPenghuni !== (int) $event['id_gedung']) {
                return $this->failForbidden('Event ini khusus untuk penghuni gedung terkait.');
            }
        }

        // Hari libur: seluruh absen nonaktif, termasuk event
        if ($libur = $this->eventService->tanggalLibur($event['tanggal'])) {
            return $this->fail('Tanggal event bertepatan dengan hari libur (' . $libur['Keterangan'] . '), absen dinonaktifkan.', 400);
        }

        // Periksa apakah sudah pernah presensi Hadir
        $presensiLama = $this->db->table('presensi_event')
            ->where('id_event', $idEvent)
            ->where('nim', $nim)
            ->get()->getRowArray();

        // Hadir dengan foto yang belum/sudah diterima tidak bisa diulang; foto ditolak boleh absen ulang
        if ($presensiLama && $presensiLama['status'] === 'Hadir') {
            return $this->fail('Anda sudah melakukan presensi untuk event ini.', 400);
        }
        $absenUlang = $presensiLama && ($presensiLama['Status_foto'] ?? null) === 'Ditolak';

        // Cek mode uji (abaikan jam / radius)
        $modeUjiRow = $this->db->table('pengaturan')->where('Kunci', 'mode_uji')->get()->getRowArray();
        $modeUji = $modeUjiRow ? json_decode($modeUjiRow['Nilai'], true) : [];
        $abaikanJam    = ! empty($modeUji['abaikanJam']);
        $abaikanRadius = ! empty($modeUji['abaikanRadius']);

        // 1. Validasi Waktu
        $hariIni = date('Y-m-d');
        $jamSekarang = date('H:i:s');

        if (! $abaikanJam) {
            if ($event['tanggal'] !== $hariIni) {
                if ($event['tanggal'] > $hariIni) {
                    return $this->fail('Event belum dimulai (tanggal: ' . $event['tanggal'] . ').', 400);
                } else {
                    return $this->fail('Event sudah berakhir.', 400);
                }
            }

            // Izinkan presensi mulai 30 menit sebelum jam mulai hingga jam selesai
            // Event mulai sebelum 00:30: toleransi jangan mundur ke hari sebelumnya (23:xx)
            $mulaiDetik     = strtotime($event['jam_mulai']);
            $toleransiMulai = date('Y-m-d', $mulaiDetik - 1800) !== date('Y-m-d', $mulaiDetik) ? '00:00:00' : date('H:i:s', $mulaiDetik - 1800);
            if ($jamSekarang < $toleransiMulai) {
                return $this->fail('Presensi belum dibuka. Dibuka mulai pukul ' . substr($event['jam_mulai'], 0, 5) . ' WIB.', 400);
            }
            if ($jamSekarang > $event['jam_selesai']) {
                return $this->fail('Presensi telah ditutup karena event telah selesai (pukul ' . substr($event['jam_selesai'], 0, 5) . ' WIB).', 400);
            }
        }

        // 2. Validasi Radius Lokasi
        $jarakMeter = 0.0;
        if ($event['latitude'] !== null && $event['longitude'] !== null) {
            if ($lat === null || $lng === null) {
                return $this->fail('Lokasi GPS tidak terbaca. Pastikan izin lokasi perangkat telah diaktifkan.', 400);
            }

            $jarakMeter = $this->eventService->haversine(
                $lat,
                $lng,
                (float) $event['latitude'],
                (float) $event['longitude']
            );

            $radiusMaks = (int) $event['radius_meter'];
            if (! $abaikanRadius && $jarakMeter > $radiusMaks) {
                $selisih = round($jarakMeter - $radiusMaks);
                return $this->fail(sprintf(
                    'Anda berada di luar radius lokasi event (%d m dari titik pusat, maksimal %d m). Kurang mendekat sekitar %d meter.',
                    round($jarakMeter),
                    $radiusMaks,
                    $selisih
                ), 400);
            }
        }

        // 3. Validasi Foto Wajah
        if (empty($fotoData)) {
            return $this->fail('Foto wajah selfie wajib diambil untuk absensi event.', 400);
        }

        $namaFoto = $this->simpanFotoWajahEvent($fotoData, $nim, $idEvent);
        if (! $namaFoto) {
            return $this->fail('Format foto tidak valid atau gagal diproses.', 400);
        }

        $waktuSekarang = date('H:i:s');
        $now = date('Y-m-d H:i:s');

        if ($presensiLama) {
            // Update baris lama (misal sebelumnya di-generate 'Tidak Hadir' lalu diuji)
            $this->db->table('presensi_event')->where('id', $presensiLama['id'])->update([
                'tanggal'     => $hariIni,
                'waktu'       => $waktuSekarang,
                'latitude'    => $lat,
                'longitude'   => $lng,
                'jarak_meter' => $jarakMeter,
                'foto'        => $namaFoto,
                'status'      => 'Hadir',
                'keterangan'  => $absenUlang ? 'Absen ulang setelah foto ditolak' : 'Presensi mandiri via sistem',
                'Status_foto' => 'Menunggu',
                'Catatan_validasi' => null,
                'Divalidasi_oleh'  => null,
                'Divalidasi_pada'  => null,
                'updated_at'  => $now,
            ]);
        } else {
            $this->db->table('presensi_event')->insert([
                'id_event'    => $idEvent,
                'nim'         => $nim,
                'tanggal'     => $hariIni,
                'waktu'       => $waktuSekarang,
                'latitude'    => $lat,
                'longitude'   => $lng,
                'jarak_meter' => $jarakMeter,
                'foto'        => $namaFoto,
                'status'      => 'Hadir',
                'keterangan'  => 'Presensi mandiri via sistem',
                'Status_foto' => 'Menunggu',
                'created_at'  => $now,
                'updated_at'  => $now,
            ]);
        }

        return $this->respond([
            'status'     => 'success',
            'message'    => 'Presensi event berhasil dicatat. Foto menunggu validasi fasil.',
            'jarakMeter' => round($jarakMeter, 1),
            'waktu'      => $waktuSekarang,
        ]);
    }

    // ----------------------------------------------------
    // GET /api/event/foto-validasi  (fasil)
    // Foto absen event penghuni gedung binaan, untuk divalidasi seperti presensi harian
    // ----------------------------------------------------
    public function fotoValidasiEvent()
    {
        $user = $this->tokenUser();
        $role = strtolower($user['role'] ?? '');
        // Fasil: foto penghuni gedungnya. Admin: semua gedung (lihat saja; validasi tetap oleh fasil)
        if ($role === 'admin') {
            return $this->respond($this->eventService->daftarFotoEvent(null));
        }
        if ($role !== 'fasil') {
            return $this->failForbidden('Hanya fasil dan admin yang dapat melihat foto event.');
        }

        return $this->respond($this->eventService->daftarFotoEvent($user['nim'] ?? ''));
    }

    // ----------------------------------------------------
    // POST /api/event/validasi-foto  { id, status: Diterima|Ditolak, catatan }
    // Foto ditolak = kehadiran event tidak terbukti -> Tidak Hadir (boleh absen ulang selama event berlangsung)
    // ----------------------------------------------------
    public function validasiFotoEvent()
    {
        $user = $this->tokenUser();
        $nimFasil = $user['nim'] ?? '';
        if (strtolower($user['role'] ?? '') !== 'fasil') {
            return $this->failForbidden('Hanya fasil yang dapat memvalidasi foto event.');
        }
        $input   = $this->request->getJSON(true) ?? $this->request->getPost();
        $id      = (int) ($input['id'] ?? 0);
        $status  = $input['status'] ?? '';
        $catatan = trim((string) ($input['catatan'] ?? ''));
        if (! $id || ! in_array($status, ['Diterima', 'Ditolak'], true)) {
            return $this->fail('ID presensi event dan status validasi (Diterima/Ditolak) wajib diisi.', 400);
        }
        if ($status === 'Ditolak' && $catatan === '') {
            return $this->fail('Catatan wajib diisi saat menolak foto.', 400);
        }

        $row = $this->db->query("
            SELECT pe.*, g.NIM_Pj FROM presensi_event pe
            JOIN user u ON BINARY u.NIM = BINARY pe.nim
            JOIN kamar k ON BINARY k.Nomor_kamar = BINARY u.Nomor_kamar
            JOIN gedung g ON g.Id_Gedung = k.Id_Gedung
            WHERE pe.id = ?
        ", [$id])->getRowArray();
        if (! $row) {
            return $this->failNotFound('Presensi event tidak ditemukan.');
        }
        if ($row['NIM_Pj'] !== $nimFasil) {
            return $this->failForbidden('Hanya fasil PJ gedung penghuni ini yang dapat memvalidasi foto.');
        }
        if (($row['Status_foto'] ?? null) !== 'Menunggu') {
            return $this->fail('Foto absen event ini sudah divalidasi.', 409);
        }

        $now  = date('Y-m-d H:i:s');
        $data = [
            'Status_foto'      => $status,
            'Catatan_validasi' => $catatan !== '' ? $catatan : null,
            'Divalidasi_oleh'  => $nimFasil,
            'Divalidasi_pada'  => $now,
            'updated_at'       => $now,
        ];
        if ($status === 'Ditolak') {
            $data += ['status' => 'Tidak Hadir', 'keterangan' => 'Foto ditolak: ' . $catatan];
        }
        $this->db->table('presensi_event')->where('id', $id)->where('Status_foto', 'Menunggu')->update($data);
        if ($this->db->affectedRows() === 0) {
            return $this->fail('Foto absen event ini sudah divalidasi.', 409);
        }

        return $this->respond([
            'status'  => 'success',
            'message' => $status === 'Diterima' ? 'Foto absen event diterima' : 'Foto ditolak, kehadiran event dicatat Tidak Hadir',
        ]);
    }

    // ----------------------------------------------------
    // GET /api/event/foto/(:segment)
    // ----------------------------------------------------
    public function fotoEvent(string $nama)
    {
        $namaBersih = basename($nama);
        $path = WRITEPATH . 'uploads/event/' . $namaBersih;
        if (! is_file($path)) {
            return $this->failNotFound('Foto event tidak ditemukan.');
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime  = finfo_file($finfo, $path);
        finfo_close($finfo);

        return $this->response
            ->setHeader('Content-Type', $mime ?: 'image/jpeg')
            ->setHeader('Cache-Control', 'private, max-age=86400')
            ->setBody(file_get_contents($path));
    }

    // ----------------------------------------------------
    // GET /api/event/sampul/(:segment) — foto sampul event (semua pengguna yang login)
    // ----------------------------------------------------
    public function sampulEvent(string $nama)
    {
        $path = WRITEPATH . 'uploads/event_sampul/' . basename($nama);
        if (! is_file($path)) {
            return $this->failNotFound('Foto sampul tidak ditemukan.');
        }
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime  = finfo_file($finfo, $path);
        finfo_close($finfo);

        return $this->response
            ->setHeader('Content-Type', $mime ?: 'image/jpeg')
            ->setHeader('Cache-Control', 'private, max-age=86400')
            ->setBody(file_get_contents($path));
    }

    /** Simpan data URL gambar sampul; null bila bukan gambar valid atau > 3 MB */
    private function simpanSampul(string $dataUrl): ?string
    {
        if (! preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/s', $dataUrl, $cocok)) {
            return null;
        }
        $biner = base64_decode($cocok[2], true);
        if ($biner === false || strlen($biner) < 100 || strlen($biner) > 3 * 1024 * 1024) {
            return null;
        }
        // Pastikan isinya benar-benar gambar
        $info = @getimagesizefromstring($biner);
        if ($info === false || ! in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
            return null;
        }
        $ekstensi = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$info[2]];

        $folder = WRITEPATH . 'uploads/event_sampul';
        if (! is_dir($folder)) {
            mkdir($folder, 0755, true);
        }
        $namaFile = 'sampul_' . date('Ymd') . '_' . bin2hex(random_bytes(8)) . '.' . $ekstensi;
        file_put_contents($folder . '/' . $namaFile, $biner);

        return $namaFile;
    }

    private function hapusBerkasSampul(string $nama): void
    {
        $path = WRITEPATH . 'uploads/event_sampul/' . basename($nama);
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private function simpanFotoWajahEvent(string $dataUrl, string $nim, int $idEvent): ?string
    {
        if (! preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/s', $dataUrl, $cocok)) {
            return null;
        }

        $ekstensi = strtolower($cocok[1]) === 'png' ? 'png' : (strtolower($cocok[1]) === 'webp' ? 'webp' : 'jpg');
        $biner = base64_decode($cocok[2], true);
        if ($biner === false || strlen($biner) < 100) {
            return null;
        }

        $folder = WRITEPATH . 'uploads/event';
        if (! is_dir($folder)) {
            mkdir($folder, 0755, true);
        }

        $namaFile = sprintf('ev_%d_%s_%s.%s', $idEvent, $nim, bin2hex(random_bytes(6)), $ekstensi);
        file_put_contents($folder . '/' . $namaFile, $biner);

        return $namaFile;
    }
}
