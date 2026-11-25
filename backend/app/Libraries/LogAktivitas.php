<?php

namespace App\Libraries;

use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Pencatat log aktivitas (siapa, apa, kapan).
 * Dipanggil filter CatatAktivitas untuk setiap permintaan yang mengubah data, dan oleh perintah
 * terjadwal (pelaku = sistem). Pencatatan tidak pernah menggagalkan permintaan aslinya.
 */
class LogAktivitas
{
    /** Rute API (tanpa awalan api/) => [entitas, label aksi] */
    private const AKSI = [
        'auth/login'                     => ['akun', 'Masuk ke sistem'],
        'auth/change-password'           => ['akun', 'Mengganti password'],
        'auth/profile-photo'             => ['akun', 'Mengganti foto profil'],
        'auth/profile'                   => ['akun', 'Memperbarui profil'],
        'penghuni/reset-password'        => ['akun', 'Mereset password penghuni'],
        'seed'                           => ['sistem', 'Menjalankan seeder database'],
        'gedung/add'                     => ['gedung', 'Menambah gedung'],
        'gedung/update'                  => ['gedung', 'Mengubah data gedung'],
        'gedung/delete'                  => ['gedung', 'Menghapus gedung'],
        'gedung/pj'                      => ['gedung', 'Menetapkan PJ gedung'],
        'kamar/add'                      => ['kamar', 'Menambah kamar'],
        'kamar/update'                   => ['kamar', 'Mengubah data kamar'],
        'kamar/delete'                   => ['kamar', 'Menghapus kamar'],
        'penghuni'                       => ['penghuni', 'Menambah penghuni'],
        'penghuni/update'                => ['penghuni', 'Mengubah data penghuni'],
        'penghuni/toggle-status'         => ['penghuni', 'Mengubah status aktif penghuni'],
        'presensi'                       => ['presensi', 'Presensi mandiri'],
        'presensi/koreksi'               => ['presensi', 'Mengoreksi presensi'],
        'presensi/validasi-foto'         => ['presensi', 'Memvalidasi foto presensi'],
        'presensi/validasi-foto-massal'  => ['presensi', 'Menerima foto presensi (massal)'],
        'izin'                           => ['izin', 'Mengajukan izin'],
        'izin/status'                    => ['izin', 'Memutuskan izin'],
        'izin/batal'                     => ['izin', 'Membatalkan izin'],
        'event/add'                      => ['event', 'Membuat event'],
        'event/update'                   => ['event', 'Mengubah event'],
        'event/delete'                   => ['event', 'Menghapus event'],
        'event/absen'                    => ['event', 'Presensi event'],
        'pengumuman/add'                 => ['pengumuman', 'Mengirim pengumuman'],
        'pengumuman/update'              => ['pengumuman', 'Mengubah pengumuman'],
        'pengumuman/delete'              => ['pengumuman', 'Menghapus pengumuman'],
        'libur/update'                   => ['pengaturan', 'Mengubah hari libur'],
        'event/validasi-foto'            => ['presensi', 'Memvalidasi foto absen event'],
        'sesi'                           => ['pengaturan', 'Mengubah jadwal sesi'],
        'sesi-gedung'                    => ['pengaturan', 'Mengubah jadwal absen malam gedung'],
        'libur'                          => ['pengaturan', 'Menambah hari libur'],
        'libur/delete'                   => ['pengaturan', 'Menghapus hari libur'],
        'mode-uji'                       => ['pengaturan', 'Mengubah mode uji'],
        'aturan-presensi'                => ['pengaturan', 'Mengubah aturan presensi'],
        'template-alasan'                => ['pengaturan', 'Mengubah template alasan validasi foto'],
    ];

    // Kunci yang tidak boleh ikut tersimpan (rahasia atau berkas besar)
    private const KUNCI_RAHASIA = '/pass|token|foto|bukti|file|gambar|image|signature/i';

    /** Catat aktivitas dari permintaan HTTP yang sudah selesai diproses */
    public static function dariPermintaan(RequestInterface $request, ResponseInterface $response): void
    {
        try {
            $path = trim(preg_replace('#^api/#', '', trim($request->getPath(), '/')), '/');
            $input = $request->getJSON(true) ?? $request->getPost() ?? [];
            $input = is_array($input) ? $input : [];
            $balasan = json_decode((string) $response->getBody(), true);
            $balasan = is_array($balasan) ? $balasan : [];
            $kode = $response->getStatusCode();

            [$entitas, $aksi] = self::AKSI[$path] ?? ['lainnya', strtoupper($request->getMethod()) . ' /api/' . $path];
            $aksi = self::perjelasAksi($path, $aksi, $input);

            // Pelaku: dari token login; untuk login dari data balasan (berhasil) atau NIM yang dicoba (gagal)
            $aktor = self::aktorDariToken($request);
            if ($path === 'auth/login') {
                $aktor = [
                    'nim'  => $balasan['data']['nim'] ?? (isset($input['nim']) ? (string) $input['nim'] : null),
                    'role' => $balasan['data']['role'] ?? null,
                ];
            }

            $pesan = $balasan['message'] ?? $balasan['messages']['error'] ?? $balasan['error'] ?? null;

            self::simpan([
                'NIM'        => $aktor['nim'] ?? null,
                'Peran'      => $aktor['role'] ?? null,
                'Entitas'    => $entitas,
                'Aksi'       => $aksi,
                'Rute'       => strtoupper($request->getMethod()) . ' /api/' . $path,
                'Target'     => self::target($input),
                'Keterangan' => is_string($pesan) ? mb_substr($pesan, 0, 255) : null,
                'Status'     => $kode < 400 ? 'berhasil' : 'gagal',
                'Kode_http'  => $kode,
                'Data'       => self::ringkasData($input),
                'Alamat_ip'  => $request->getIPAddress(),
                'Agen'       => mb_substr((string) $request->getHeaderLine('User-Agent'), 0, 255),
            ]);
        } catch (Throwable $e) {
            log_message('error', 'Log aktivitas gagal dicatat: ' . $e->getMessage());
        }
    }

    /** Catat aktivitas yang dijalankan sistem (perintah terjadwal), tanpa pelaku */
    public static function sistem(string $entitas, string $aksi, string $keterangan, array $data = []): void
    {
        try {
            self::simpan([
                'NIM'        => null,
                'Peran'      => 'sistem',
                'Entitas'    => $entitas,
                'Aksi'       => $aksi,
                'Rute'       => 'CLI',
                'Keterangan' => mb_substr($keterangan, 0, 255),
                'Status'     => 'berhasil',
                'Data'       => $data === [] ? null : json_encode($data, JSON_UNESCAPED_UNICODE),
            ]);
        } catch (Throwable $e) {
            log_message('error', 'Log aktivitas sistem gagal dicatat: ' . $e->getMessage());
        }
    }

    private static function simpan(array $baris): void
    {
        $db = \Config\Database::connect();
        // Migration belum dijalankan: lewati tanpa mengganggu permintaan
        if (! $db->tableExists('log_aktivitas')) {
            return;
        }
        $db->table('log_aktivitas')->insert(['Waktu' => date('Y-m-d H:i:s')] + $baris);
    }

    // Aksi yang sama bisa berarti keputusan berbeda; ambil dari data yang dikirim
    private static function perjelasAksi(string $path, string $aksi, array $input): string
    {
        $status = $input['status'] ?? null;
        if ($path === 'izin/status') {
            return $status === 'Disetujui' ? 'Menyetujui izin' : ($status === 'Ditolak' ? 'Menolak izin' : $aksi);
        }
        if ($path === 'presensi/validasi-foto') {
            return $status === 'Diterima' ? 'Menerima foto presensi' : ($status === 'Ditolak' ? 'Menolak foto presensi' : $aksi);
        }
        if ($path === 'presensi/koreksi' && is_string($status)) {
            return 'Mengoreksi presensi menjadi ' . $status;
        }

        return $aksi;
    }

    /** Sasaran perubahan yang paling mudah dikenali, mis. "NIM 2310933001" atau "#12" */
    private static function target(array $input): ?string
    {
        if (isset($input['ids']) && is_array($input['ids'])) {
            return count($input['ids']) . ' data';
        }
        $bagian = [];
        if (isset($input['id']) && is_scalar($input['id'])) {
            $bagian[] = '#' . $input['id'];
        }
        if (isset($input['nim']) && is_scalar($input['nim']) && $input['nim'] !== '') {
            $bagian[] = 'NIM ' . $input['nim'];
        }
        if (isset($input['nomorKamar']) && is_scalar($input['nomorKamar']) && $input['nomorKamar'] !== '') {
            $bagian[] = 'Kamar ' . $input['nomorKamar'];
        }
        if (isset($input['tanggal']) && is_scalar($input['tanggal']) && isset($input['sesi']) && is_scalar($input['sesi'])) {
            $bagian[] = $input['tanggal'] . ' ' . $input['sesi'];
        }

        return $bagian === [] ? null : mb_substr(implode(' · ', $bagian), 0, 120);
    }

    /** Data yang dikirim tanpa rahasia & berkas; teks panjang dipotong, total dibatasi 2 KB */
    private static function ringkasData(array $input): ?string
    {
        $bersih = self::bersihkan($input);
        if ($bersih === []) {
            return null;
        }
        $json = json_encode($bersih, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return $json === false ? null : (strlen($json) > 2000 ? mb_substr($json, 0, 2000) . '…' : $json);
    }

    private static function bersihkan(array $data, int $kedalaman = 0): array
    {
        $hasil = [];
        foreach ($data as $k => $v) {
            if (is_string($k) && preg_match(self::KUNCI_RAHASIA, $k)) {
                $hasil[$k] = $v === null || $v === '' ? $v : '[disembunyikan]';
            } elseif (is_array($v)) {
                $hasil[$k] = $kedalaman >= 3 ? '[…]' : self::bersihkan($v, $kedalaman + 1);
            } elseif (is_string($v) && str_starts_with($v, 'data:')) {
                $hasil[$k] = '[berkas]';
            } elseif (is_string($v) && mb_strlen($v) > 200) {
                $hasil[$k] = mb_substr($v, 0, 200) . '…';
            } else {
                $hasil[$k] = $v;
            }
        }

        return $hasil;
    }

    /** Pelaku dari token login (format sama dengan filter ApiAuth); kosong bila tidak sah */
    public static function aktorDariToken(RequestInterface $request): array
    {
        $raw = preg_replace('/^Bearer\s+/i', '', $request->getHeaderLine('Authorization'));
        [$encoded, $signature] = array_pad(explode('.', (string) $raw, 2), 2, '');
        $data = json_decode(base64_decode(strtr($encoded, '-_', '+/')) ?: '', true);
        $expected = hash_hmac('sha256', $encoded, env('encryption.key', 'sip-asrama-v1'));

        return is_array($data) && $signature !== '' && hash_equals($expected, $signature) ? $data : [];
    }
}
