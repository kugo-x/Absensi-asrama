<?php

namespace Tests\Feature\Modul3;

use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;
use CodeIgniter\Test\TestResponse;

/**
 * Dasar tes Modul 3 (Presensi Harian).
 *
 * Memakai DB uji terpisah (grup `tests` di backend/.env → absensi_asrama_test).
 * Setiap tes: semua migration App dijalankan ulang ($refresh) lalu fixture di bawah diisi.
 *
 * Fixture:
 *  - Gedung 1 "Gedung Uji A" (PJ FAS1) & Gedung 2 "Gedung Uji B" (PJ FAS2), radius 50 m
 *  - PNG1, PNG2 : Mahasiswa aktif, kamar di Gedung A
 *  - PNG3       : Mahasiswa aktif, kamar di Gedung B
 *  - NON1       : Mahasiswa NONAKTIF (punya kamar)
 *  - TKM1       : Mahasiswa aktif TANPA kamar
 *  - FAS1, FAS2 : Fasil (punya kamar), ADM : Admin
 */
abstract class Modul3TestCase extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;

    protected $refresh   = true;
    protected $namespace = 'App';

    protected const LAT = -0.914488;
    protected const LNG = 100.466542;
    protected const DIBUAT = '2026-01-01 08:00:00';

    protected function setUp(): void
    {
        parent::setUp();
        $this->isiFixture();
    }

    protected function tearDown(): void
    {
        // Hapus berkas foto wajah yang dibuat selama tes (writable/ dipakai bersama dev)
        if ($this->db->tableExists('presensi')) {
            $rows = $this->db->table('presensi')->select('Foto_wajah')->where('Foto_wajah IS NOT NULL', null, false)->get()->getResultArray();
            foreach ($rows as $r) {
                $berkas = WRITEPATH . 'uploads/wajah/' . $r['Foto_wajah'];
                if ($r['Foto_wajah'] !== '' && is_file($berkas)) {
                    unlink($berkas);
                }
            }
        }
        parent::tearDown();
    }

    private function isiFixture(): void
    {
        $t = self::DIBUAT;
        $this->db->table('gedung')->insertBatch([
            ['Id_Gedung' => 1, 'Nama' => 'Gedung Uji A', 'NIM_Pj' => null, 'Latitude' => self::LAT, 'Longitude' => self::LNG, 'Radius_meter' => 50, 'created_at' => $t, 'updated_at' => $t],
            ['Id_Gedung' => 2, 'Nama' => 'Gedung Uji B', 'NIM_Pj' => null, 'Latitude' => -0.9149, 'Longitude' => 100.467, 'Radius_meter' => 50, 'created_at' => $t, 'updated_at' => $t],
        ]);
        $this->db->table('kamar')->insertBatch([
            ['Nomor_kamar' => 'A-101', 'Lantai' => 1, 'Kapasitas' => 6, 'Id_Gedung' => 1, 'created_at' => $t, 'updated_at' => $t],
            ['Nomor_kamar' => 'B-101', 'Lantai' => 1, 'Kapasitas' => 6, 'Id_Gedung' => 2, 'created_at' => $t, 'updated_at' => $t],
        ]);
        $sandi = password_hash('rahasia', PASSWORD_BCRYPT, ['cost' => 4]);
        $user  = static fn (string $nim, string $nama, ?string $kamar, string $role, string $status = 'Aktif') => [
            'NIM' => $nim, 'Nama' => $nama, 'Nomor_kamar' => $kamar, 'Password' => $sandi, 'Role' => $role,
            'Status_aktif' => $status, 'created_at' => $t, 'updated_at' => $t,
        ];
        $this->db->table('user')->insertBatch([
            $user('PNG1', 'Penghuni Satu', 'A-101', 'Mahasiswa'),
            $user('PNG2', 'Penghuni Dua', 'A-101', 'Mahasiswa'),
            $user('PNG3', 'Penghuni Tiga', 'B-101', 'Mahasiswa'),
            $user('NON1', 'Penghuni Nonaktif', 'A-101', 'Mahasiswa', 'Nonaktif'),
            $user('TKM1', 'Penghuni Tanpa Kamar', null, 'Mahasiswa'),
            $user('FAS1', 'Fasil Satu', 'A-101', 'Fasil'),
            $user('FAS2', 'Fasil Dua', 'B-101', 'Fasil'),
            $user('ADM', 'Admin Uji', null, 'Admin'),
        ]);
        $this->db->table('gedung')->where('Id_Gedung', 1)->update(['NIM_Pj' => 'FAS1']);
        $this->db->table('gedung')->where('Id_Gedung', 2)->update(['NIM_Pj' => 'FAS2']);
    }

    // ------------------------------------------------------------ helper

    /** Token login dengan algoritma yang sama seperti AuthController */
    protected function token(string $nim, string $role): string
    {
        $encoded = rtrim(strtr(base64_encode(json_encode(['nim' => $nim, 'role' => $role, 'exp' => time() + 3600])), '+/', '-_'), '=');

        return $encoded . '.' . hash_hmac('sha256', $encoded, env('encryption.key', 'sip-asrama-v1'));
    }

    protected function postApi(string $path, array $body, ?string $token = null): TestResponse
    {
        return $this->withHeaders($token ? ['Authorization' => 'Bearer ' . $token] : [])
            ->withBodyFormat('json')
            ->post('api/' . $path, $body);
    }

    protected function getApi(string $path, ?string $token = null): TestResponse
    {
        return $this->withHeaders($token ? ['Authorization' => 'Bearer ' . $token] : [])->get('api/' . $path);
    }

    /** Isi JSON respons sebagai array */
    protected function json(TestResponse $r): array
    {
        return json_decode($r->getJSON() ?: '[]', true) ?? [];
    }

    /** Pesan galat dari fail() atau pesan sukses */
    protected function pesan(TestResponse $r): string
    {
        $j = $this->json($r);

        return (string) ($j['messages']['error'] ?? $j['message'] ?? $j['error'] ?? '');
    }

    protected function sesi(string $nama, string $mulai, string $selesai, int $aktif = 1, string $dibuat = self::DIBUAT): void
    {
        $this->db->table('sesi')->insert(['Nama' => $nama, 'Jam_mulai' => $mulai, 'Jam_selesai' => $selesai, 'Aktif' => $aktif, 'created_at' => $dibuat, 'updated_at' => $dibuat]);
    }

    /** Sesi yang sedang dibuka sepanjang hari (untuk tes check-in) */
    protected function sesiBuka(string $nama = 'Uji'): void
    {
        $this->sesi($nama, '00:00:00', '23:59:59');
    }

    /** Foto wajah JPEG kecil yang valid sebagai data URL */
    protected function foto(): string
    {
        $img = imagecreatetruecolor(32, 32);
        imagefill($img, 0, 0, imagecolorallocate($img, 30, 120, 80));
        ob_start();
        imagejpeg($img);
        $data = ob_get_clean();

        return 'data:image/jpeg;base64,' . base64_encode($data);
    }

    protected function bodyCheckIn(array $ubah = []): array
    {
        return array_merge(['sesi' => 'Uji', 'latitude' => self::LAT, 'longitude' => self::LNG, 'akurasi' => 10, 'fotoWajah' => $this->foto()], $ubah);
    }

    protected function izin(string $nim, string $mulai, ?string $selesai, ?string $sesi, string $status = 'Disetujui'): void
    {
        $this->db->table('izin')->insert([
            'NIM' => $nim, 'Alasan' => 'uji', 'Status_persetujuan' => $status, 'Tanggal' => $mulai,
            'Tanggal_selesai' => $selesai, 'Sesi' => $sesi, 'created_at' => self::DIBUAT, 'updated_at' => self::DIBUAT,
        ]);
    }

    protected function libur(string $mulai, string $selesai): void
    {
        $this->db->table('hari_libur')->insert(['Tanggal_mulai' => $mulai, 'Tanggal_selesai' => $selesai, 'Keterangan' => 'Libur uji', 'created_at' => self::DIBUAT, 'updated_at' => self::DIBUAT]);
    }

    protected function presensi(array $data): int
    {
        $this->db->table('presensi')->insert(array_merge([
            'Tanggal' => date('Y-m-d'), 'Sesi' => 'Uji', 'Waktu' => date('Y-m-d H:i:s'), 'Status' => 'Hadir',
            'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s'),
        ], $data));

        return (int) $this->db->insertID();
    }

    protected function setPengaturan(string $kunci, string $nilai): void
    {
        $this->db->table('pengaturan')->replace(['Kunci' => $kunci, 'Nilai' => $nilai, 'updated_at' => date('Y-m-d H:i:s')]);
    }

    protected function barisPresensi(string $nim, ?string $tanggal = null, string $sesi = 'Uji'): ?array
    {
        return $this->db->table('presensi')->where('NIM', $nim)->where('Tanggal', $tanggal ?? date('Y-m-d'))->where('Sesi', $sesi)->get()->getRowArray();
    }
}
