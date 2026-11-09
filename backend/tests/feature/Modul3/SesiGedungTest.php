<?php

namespace Tests\Feature\Modul3;

use App\Libraries\PresensiService;

require_once __DIR__ . '/Modul3TestCase.php';

/**
 * Absen malam per gedung (tabel sesi_gedung):
 * admin hanya mengatur sesi global (mis. Subuh); jam absen malam diatur fasil PJ tiap gedung.
 * Gedung yang belum mengatur absen malam = tidak ada absen malam.
 *
 * @internal
 */
final class SesiGedungTest extends Modul3TestCase
{
    private const TGL = '2026-03-02';

    private function sesiGedung(int $gedung, string $mulai, string $selesai, int $aktif = 1, string $dibuat = self::DIBUAT): void
    {
        $this->db->table('sesi_gedung')->insert([
            'Id_Gedung' => $gedung, 'Nama' => PresensiService::SESI_PER_GEDUNG, 'Jam_mulai' => $mulai, 'Jam_selesai' => $selesai,
            'Aktif' => $aktif, 'Diatur_oleh' => $gedung === 1 ? 'FAS1' : 'FAS2', 'created_at' => $dibuat, 'updated_at' => $dibuat,
        ]);
    }

    private function simpan(array $body, string $nim = 'FAS1', string $role = 'fasil')
    {
        return $this->postApi('sesi-gedung', $body, $this->token($nim, $role));
    }

    // ------------------------------------------------------------ POST /api/sesi-gedung

    public function testFasilMenyimpanAbsenMalamGedungnya(): void
    {
        $r = $this->simpan(['jamMulai' => '18:30', 'jamSelesai' => '21:00', 'aktif' => true]);

        $r->assertStatus(200);
        $this->assertStringContainsString('Gedung Uji A', $this->pesan($r));
        $row = $this->db->table('sesi_gedung')->where('Id_Gedung', 1)->get()->getRowArray();
        $this->assertSame('18:30:00', $row['Jam_mulai']);
        $this->assertSame('21:00:00', $row['Jam_selesai']);
        $this->assertSame('FAS1', $row['Diatur_oleh']);
        $this->assertSame(0, $this->db->table('sesi_gedung')->where('Id_Gedung', 2)->countAllResults());
    }

    public function testSimpanUlangMemperbaruiBarisYangSama(): void
    {
        $this->simpan(['jamMulai' => '18:00', 'jamSelesai' => '20:00', 'aktif' => true])->assertStatus(200);
        $this->simpan(['jamMulai' => '19:00', 'jamSelesai' => '21:00', 'aktif' => false])->assertStatus(200);

        $rows = $this->db->table('sesi_gedung')->where('Id_Gedung', 1)->get()->getResultArray();
        $this->assertCount(1, $rows);
        $this->assertSame('19:00:00', $rows[0]['Jam_mulai']);
        $this->assertSame('0', (string) $rows[0]['Aktif']);
    }

    public function testHanyaFasilYangBoleh(): void
    {
        $this->simpan(['jamMulai' => '18:00', 'jamSelesai' => '20:00', 'aktif' => true], 'ADM', 'admin')->assertStatus(403);
        $this->simpan(['jamMulai' => '18:00', 'jamSelesai' => '20:00', 'aktif' => true], 'PNG1', 'penghuni')->assertStatus(403);
        $this->assertSame(0, $this->db->table('sesi_gedung')->countAllResults());
    }

    public function testFasilTanpaGedungDitolak(): void
    {
        $this->db->table('gedung')->where('Id_Gedung', 2)->update(['NIM_Pj' => null]);

        $this->simpan(['jamMulai' => '18:00', 'jamSelesai' => '20:00', 'aktif' => true], 'FAS2')->assertStatus(403);
    }

    public function testJamTidakValidDitolak(): void
    {
        $this->simpan(['jamMulai' => '25:00', 'jamSelesai' => '20:00', 'aktif' => true])->assertStatus(400);
        $this->simpan(['jamMulai' => '', 'jamSelesai' => '20:00', 'aktif' => true])->assertStatus(400);
        $r = $this->simpan(['jamMulai' => '20:00', 'jamSelesai' => '19:00', 'aktif' => true]);
        $r->assertStatus(400);
        $this->assertStringContainsString('setelah jam mulai', $this->pesan($r));
    }

    public function testBertabrakanDenganSesiGlobalDitolak(): void
    {
        $this->sesi('Subuh', '04:00:00', '06:00:00');

        $r = $this->simpan(['jamMulai' => '05:00', 'jamSelesai' => '07:00', 'aktif' => true]);
        $r->assertStatus(400);
        $this->assertStringContainsString('Subuh', $this->pesan($r));
        // Nonaktif tidak diperiksa tabrakannya
        $this->simpan(['jamMulai' => '05:00', 'jamSelesai' => '07:00', 'aktif' => false])->assertStatus(200);
    }

    // ------------------------------------------------------------ POST /api/sesi (admin, global saja)

    public function testSaveSesiHanyaAdmin(): void
    {
        $body = ['sesi' => [['nama' => 'Subuh', 'jamMulai' => '04:00', 'jamSelesai' => '06:00', 'aktif' => true]]];

        $this->postApi('sesi', $body, $this->token('FAS1', 'fasil'))->assertStatus(403);
        $this->postApi('sesi', $body, $this->token('ADM', 'admin'))->assertStatus(200);
    }

    public function testAdminTidakBolehMembuatSesiMalam(): void
    {
        $r = $this->postApi('sesi', ['sesi' => [['nama' => 'malam', 'jamMulai' => '18:00', 'jamSelesai' => '20:00', 'aktif' => true]]], $this->token('ADM', 'admin'));

        $r->assertStatus(400);
        $this->assertStringContainsString('fasil', $this->pesan($r));
        $this->assertSame(0, $this->db->table('sesi')->countAllResults());
    }

    public function testSesiGlobalTidakBolehMenabrakAbsenMalamGedung(): void
    {
        $this->sesiGedung(1, '18:00:00', '20:00:00');

        $r = $this->postApi('sesi', ['sesi' => [['nama' => 'Isya', 'jamMulai' => '19:30', 'jamSelesai' => '21:00', 'aktif' => true]]], $this->token('ADM', 'admin'));
        $r->assertStatus(400);
        $this->assertStringContainsString('Gedung Uji A', $this->pesan($r));
    }

    // ------------------------------------------------------------ GET /api/sesi

    private function malamTerlihat(string $nim, string $role): array
    {
        $list = $this->json($this->getApi('sesi', $this->token($nim, $role)));
        $gedung = array_column(array_filter($list, static fn ($s) => $s['idGedung'] !== null), 'namaGedung');
        sort($gedung);

        return $gedung;
    }

    public function testGetSesiDibatasiSesuaiPeran(): void
    {
        $this->sesi('Subuh', '04:00:00', '06:00:00');
        $this->sesiGedung(1, '18:00:00', '20:00:00');
        $this->sesiGedung(2, '19:00:00', '21:00:00');

        $this->assertSame(['Gedung Uji A', 'Gedung Uji B'], $this->malamTerlihat('ADM', 'admin'));
        $this->assertSame(['Gedung Uji A'], $this->malamTerlihat('FAS1', 'fasil'));
        $this->assertSame(['Gedung Uji B'], $this->malamTerlihat('FAS2', 'fasil'));
        $this->assertSame(['Gedung Uji A'], $this->malamTerlihat('PNG1', 'penghuni'));
        $this->assertSame(['Gedung Uji B'], $this->malamTerlihat('PNG3', 'penghuni'));
        $this->assertSame([], $this->malamTerlihat('TKM1', 'penghuni'));

        $list = $this->json($this->getApi('sesi', $this->token('PNG1', 'penghuni')));
        $this->assertContains('Subuh', array_column($list, 'nama'));
        $malam = array_values(array_filter($list, static fn ($s) => $s['idGedung'] !== null))[0];
        $this->assertSame('18:00', $malam['jamMulai']);
        $this->assertGreaterThanOrEqual(1000000, $malam['id']);
        $this->assertSame('Fasil Satu', $malam['namaPengatur']);
    }

    // ------------------------------------------------------------ check-in

    public function testCheckInMalamMemakaiJadwalGedungPenghuni(): void
    {
        $this->sesiGedung(1, '00:00:00', '23:59:59');

        $this->postApi('presensi', $this->bodyCheckIn(['sesi' => 'Malam']), $this->token('PNG1', 'penghuni'))->assertStatus(200);
        $this->assertSame('Hadir', $this->barisPresensi('PNG1', null, 'Malam')['Status']);
    }

    public function testCheckInMalamDitolakBilaGedungBelumMengatur(): void
    {
        $this->sesiGedung(1, '00:00:00', '23:59:59');

        $r = $this->postApi('presensi', $this->bodyCheckIn(['sesi' => 'Malam']), $this->token('PNG3', 'penghuni'));
        $r->assertStatus(400);
        $this->assertStringContainsString('belum diatur', $this->pesan($r));
        $this->assertNull($this->barisPresensi('PNG3', null, 'Malam'));
    }

    public function testCheckInMalamDitolakBilaDinonaktifkan(): void
    {
        $this->sesiGedung(1, '00:00:00', '23:59:59', 0);

        $this->postApi('presensi', $this->bodyCheckIn(['sesi' => 'Malam']), $this->token('PNG1', 'penghuni'))->assertStatus(400);
    }

    // ------------------------------------------------------------ penandaan otomatis

    public function testTandaiTidakHadirHanyaUntukGedungYangMengatur(): void
    {
        $this->sesiGedung(1, '18:00:00', '20:00:00');
        // Gedung B: absen malam dinonaktifkan → tidak ada kewajiban

        $this->sesiGedung(2, '18:00:00', '20:00:00', 0);

        $hasil = (new PresensiService($this->db))->tandaiTidakHadir(self::TGL, '2026-03-02 21:00:00');

        $this->assertSame('Tidak Hadir', $this->barisPresensi('PNG1', self::TGL, 'Malam')['Status'] ?? null);
        $this->assertSame('Tidak Hadir', $this->barisPresensi('PNG2', self::TGL, 'Malam')['Status'] ?? null);
        $this->assertNull($this->barisPresensi('PNG3', self::TGL, 'Malam'));
        $this->assertContains('Malam · Gedung Uji A', array_column($hasil['sesi'], 'sesi'));
    }

    public function testTandaiTidakHadirMengikutiJamTutupMasingMasingGedung(): void
    {
        $this->sesiGedung(1, '18:00:00', '20:00:00');
        $this->sesiGedung(2, '19:00:00', '22:00:00');

        (new PresensiService($this->db))->tandaiTidakHadir(self::TGL, '2026-03-02 21:00:00');

        // Gedung A sudah ditutup, Gedung B masih berjalan
        $this->assertSame('Tidak Hadir', $this->barisPresensi('PNG1', self::TGL, 'Malam')['Status'] ?? null);
        $this->assertNull($this->barisPresensi('PNG3', self::TGL, 'Malam'));
    }
}
