<?php

namespace Tests\Feature\Modul3;

require_once __DIR__ . '/Modul3TestCase.php';

/**
 * POST /api/presensi — presensi mandiri foto + GPS
 *
 * @internal
 */
final class CheckInTest extends Modul3TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->sesiBuka();
    }

    public function testSuksesMencatatHadirFotoDanAkurasi(): void
    {
        $r = $this->postApi('presensi', $this->bodyCheckIn(), $this->token('PNG1', 'penghuni'));

        $r->assertStatus(200);
        $this->assertStringContainsString('Presensi berhasil dicatat', $this->pesan($r));
        $row = $this->barisPresensi('PNG1');
        $this->assertSame('Hadir', $row['Status']);
        $this->assertSame('Menunggu', $row['Status_foto']);
        $this->assertSame('10.00', $row['Akurasi_meter']);
        $this->assertNull($row['Dikoreksi_oleh']);
        $this->assertFileExists(WRITEPATH . 'uploads/wajah/' . $row['Foto_wajah']);
    }

    public function testPresensiGandaDitolak409(): void
    {
        $t = $this->token('PNG1', 'penghuni');
        $this->postApi('presensi', $this->bodyCheckIn(), $t)->assertStatus(200);
        $r = $this->postApi('presensi', $this->bodyCheckIn(), $t);

        $r->assertStatus(409);
        $this->assertSame(1, $this->db->table('presensi')->where('NIM', 'PNG1')->countAllResults());
    }

    public function testLuarJamSesiDitolak403(): void
    {
        $this->sesi('Tutup', '00:00:00', '00:00:01');
        $r = $this->postApi('presensi', $this->bodyCheckIn(['sesi' => 'Tutup']), $this->token('PNG1', 'penghuni'));

        $r->assertStatus(403);
        $this->assertStringContainsString('hanya dibuka pukul', $this->pesan($r));
    }

    public function testLuarRadiusDitolak403(): void
    {
        $r = $this->postApi('presensi', $this->bodyCheckIn(['latitude' => -0.9300, 'longitude' => 100.4800]), $this->token('PNG1', 'penghuni'));

        $r->assertStatus(403);
        $this->assertStringContainsString('dalam radius 50 m', $this->pesan($r));
        $this->assertNull($this->barisPresensi('PNG1'));
    }

    public function testModeUjiAbaikanJamMenerimaDiLuarJam(): void
    {
        $this->sesi('Tutup', '00:00:00', '00:00:01');
        $this->setPengaturan('uji_abaikan_jam', '1');
        $r = $this->postApi('presensi', $this->bodyCheckIn(['sesi' => 'Tutup']), $this->token('PNG1', 'penghuni'));

        $r->assertStatus(200);
        $this->assertStringContainsString('[Mode Uji]', $this->barisPresensi('PNG1', null, 'Tutup')['Keterangan']);
    }

    public function testModeUjiAbaikanRadiusMenerimaDiLuarRadius(): void
    {
        $this->setPengaturan('uji_abaikan_radius', '1');
        $r = $this->postApi('presensi', $this->bodyCheckIn(['latitude' => -0.9300, 'longitude' => 100.4800, 'akurasi' => 500]), $this->token('PNG1', 'penghuni'));

        $r->assertStatus(200);
        $this->assertSame('Hadir', $this->barisPresensi('PNG1')['Status']);
    }

    public function testHariLiburDitolak400(): void
    {
        $this->libur(date('Y-m-d'), date('Y-m-d'));
        $r = $this->postApi('presensi', $this->bodyCheckIn(), $this->token('PNG1', 'penghuni'));

        $r->assertStatus(400);
        $this->assertStringContainsString('libur', $this->pesan($r));
    }

    public function testSedangIzinDitolak400(): void
    {
        $this->izin('PNG1', date('Y-m-d'), null, null);
        $r = $this->postApi('presensi', $this->bodyCheckIn(), $this->token('PNG1', 'penghuni'));

        $r->assertStatus(400);
        $this->assertStringContainsString('izin', $this->pesan($r));
    }

    public function testIzinSesiLainTidakMenghalangi(): void
    {
        $this->izin('PNG1', date('Y-m-d'), null, 'SesiLain');
        $this->postApi('presensi', $this->bodyCheckIn(), $this->token('PNG1', 'penghuni'))->assertStatus(200);
    }

    public function testTanpaGpsDitolak400(): void
    {
        $r = $this->postApi('presensi', $this->bodyCheckIn(['latitude' => null, 'longitude' => null]), $this->token('PNG1', 'penghuni'));

        $r->assertStatus(400);
        $this->assertStringContainsString('Lokasi GPS wajib', $this->pesan($r));
    }

    public function testTanpaFotoDitolak400(): void
    {
        $body = $this->bodyCheckIn();
        unset($body['fotoWajah']);
        $r = $this->postApi('presensi', $body, $this->token('PNG1', 'penghuni'));

        $r->assertStatus(400);
        $this->assertStringContainsString('Foto wajah wajib', $this->pesan($r));
    }

    public function testFotoRusakDitolak400(): void
    {
        $r = $this->postApi('presensi', $this->bodyCheckIn(['fotoWajah' => 'data:image/jpeg;base64,' . base64_encode('ini bukan gambar')]), $this->token('PNG1', 'penghuni'));

        $r->assertStatus(400);
    }

    public function testFotoLebihDari2MbDitolak400(): void
    {
        $besar = 'data:image/jpeg;base64,' . base64_encode(str_repeat('A', 2 * 1024 * 1024 + 16));
        $r     = $this->postApi('presensi', $this->bodyCheckIn(['fotoWajah' => $besar]), $this->token('PNG1', 'penghuni'));

        $r->assertStatus(400);
        $this->assertStringContainsString('maksimal 2 MB', $this->pesan($r));
    }

    public function testAkunNonaktifDitolak403(): void
    {
        $r = $this->postApi('presensi', $this->bodyCheckIn(), $this->token('NON1', 'penghuni'));

        $r->assertStatus(403);
        $this->assertStringContainsString('tidak aktif', $this->pesan($r));
    }

    public function testTanpaKamarDitolak400(): void
    {
        $r = $this->postApi('presensi', $this->bodyCheckIn(), $this->token('TKM1', 'penghuni'));

        $r->assertStatus(400);
        $this->assertStringContainsString('belum terdaftar di kamar', $this->pesan($r));
    }

    public function testTanpaTokenDitolak401(): void
    {
        $this->postApi('presensi', $this->bodyCheckIn())->assertStatus(401);
    }

    public function testTokenRusakDitolak401(): void
    {
        $this->postApi('presensi', $this->bodyCheckIn(), 'palsu.tanda-tangan')->assertStatus(401);
    }

    public function testNimDariBodyDiabaikanMemakaiNimToken(): void
    {
        // Token milik PNG1, body mengaku PNG2: yang tercatat harus PNG1, bukan PNG2
        $r = $this->postApi('presensi', $this->bodyCheckIn(['nim' => 'PNG2']), $this->token('PNG1', 'penghuni'));

        $r->assertStatus(200);
        $this->assertNotNull($this->barisPresensi('PNG1'));
        $this->assertNull($this->barisPresensi('PNG2'));
    }

    public function testPeranSelainPenghuniDitolak403(): void
    {
        $this->postApi('presensi', $this->bodyCheckIn(), $this->token('FAS1', 'fasil'))->assertStatus(403);
        $this->postApi('presensi', $this->bodyCheckIn(), $this->token('ADM', 'admin'))->assertStatus(403);
    }

    public function testSesiTidakAktifDitolak400(): void
    {
        $this->sesi('Mati', '00:00:00', '23:59:59', 0);
        $this->postApi('presensi', $this->bodyCheckIn(['sesi' => 'Mati']), $this->token('PNG1', 'penghuni'))->assertStatus(400);
    }

    // ---- Fase 5 (C): akurasi GPS

    public function testAkurasiMelebihiBatasDitolak403(): void
    {
        $r = $this->postApi('presensi', $this->bodyCheckIn(['akurasi' => 250]), $this->token('PNG1', 'penghuni'));

        $r->assertStatus(403);
        $this->assertStringContainsString('melebihi batas 100 m', $this->pesan($r));
    }

    public function testAkurasiTidakDikirimDitolak400(): void
    {
        $body = $this->bodyCheckIn();
        unset($body['akurasi']);
        $this->postApi('presensi', $body, $this->token('PNG1', 'penghuni'))->assertStatus(400);
    }

    public function testBatasAkurasiNolBerartiTidakDiperiksa(): void
    {
        $this->setPengaturan('gps_akurasi_maks', '0');
        $this->postApi('presensi', $this->bodyCheckIn(['akurasi' => 900]), $this->token('PNG1', 'penghuni'))->assertStatus(200);
    }
}
