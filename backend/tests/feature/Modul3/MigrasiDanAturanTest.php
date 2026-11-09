<?php

namespace Tests\Feature\Modul3;

require_once __DIR__ . '/Modul3TestCase.php';

/**
 * Migration Modul 3 (rollback & migrate ulang), aturan presensi (Fase 5), dan lingkup data GET /api/presensi.
 *
 * @internal
 */
final class MigrasiDanAturanTest extends Modul3TestCase
{
    public function testRollbackSemuaLaluMigrateUlangTanpaGalat(): void
    {
        $this->regressDatabase();
        $this->assertFalse($this->db->tableExists('presensi'));

        $this->migrateDatabase();
        $this->assertTrue($this->db->tableExists('presensi'));
        foreach (['Status_foto', 'Catatan_validasi', 'Divalidasi_oleh', 'Divalidasi_pada', 'Akurasi_meter', 'Dikoreksi_oleh'] as $kolom) {
            $this->assertTrue($this->db->fieldExists($kolom, 'presensi'), $kolom);
        }
        $statusFoto = array_values(array_filter($this->db->getFieldData('presensi'), static fn ($f) => $f->name === 'Status_foto'))[0];
        $this->assertNull($statusFoto->default, 'Status_foto bawaan NULL (baris tanpa foto tidak masuk antrean)');
        $this->assertSame(3, $this->db->table('pengaturan')->whereIn('Kunci', ['gps_akurasi_maks', 'batas_tidak_hadir', 'pengingat_menit'])->countAllResults());
    }

    // ---- Fase 5: aturan presensi

    public function testAturanBisaDibacaSemuaPeranDenganNilaiBawaan(): void
    {
        $data = $this->json($this->getApi('aturan-presensi', $this->token('PNG1', 'penghuni')));
        $this->assertSame(['gpsAkurasiMaks' => 100, 'batasTidakHadir' => 3, 'pengingatMenit' => 15], $data);
    }

    public function testHanyaAdminYangBisaMengubahAturan(): void
    {
        $baru = ['gpsAkurasiMaks' => 80, 'batasTidakHadir' => 5, 'pengingatMenit' => 20];
        $this->postApi('aturan-presensi', $baru, $this->token('FAS1', 'fasil'))->assertStatus(403);
        $this->postApi('aturan-presensi', $baru, $this->token('ADM', 'admin'))->assertStatus(200);

        $this->assertSame('80', $this->db->table('pengaturan')->where('Kunci', 'gps_akurasi_maks')->get()->getRow()->Nilai);
        $this->assertSame('5', $this->db->table('pengaturan')->where('Kunci', 'batas_tidak_hadir')->get()->getRow()->Nilai);
    }

    public function testAturanDiluarRentangDitolak400(): void
    {
        $this->postApi('aturan-presensi', ['gpsAkurasiMaks' => 80, 'batasTidakHadir' => 0, 'pengingatMenit' => 20], $this->token('ADM', 'admin'))->assertStatus(400);
        $this->postApi('aturan-presensi', ['gpsAkurasiMaks' => -1, 'batasTidakHadir' => 3, 'pengingatMenit' => 20], $this->token('ADM', 'admin'))->assertStatus(400);
    }

    // ---- Lingkup data GET /api/presensi per peran

    public function testLingkupDataPresensiPerPeran(): void
    {
        $this->presensi(['NIM' => 'PNG1']);
        $this->presensi(['NIM' => 'PNG2']);
        $this->presensi(['NIM' => 'PNG3']);
        $nim = fn (string $token) => array_column($this->json($this->getApi('presensi', $token)), 'nim');

        $this->assertSame(['PNG1'], $nim($this->token('PNG1', 'penghuni')));
        $this->assertEqualsCanonicalizing(['PNG1', 'PNG2'], $nim($this->token('FAS1', 'fasil')));
        $this->assertSame(['PNG3'], $nim($this->token('FAS2', 'fasil')));
        $this->assertCount(3, $nim($this->token('ADM', 'admin')));
        $this->getApi('presensi')->assertStatus(401);
    }

    public function testBentukResponsPresensiCamelCaseDanTipe(): void
    {
        $this->presensi(['NIM' => 'PNG1', 'Latitude' => self::LAT, 'Longitude' => self::LNG, 'Akurasi_meter' => 12.5, 'Foto_wajah' => 'a.jpg', 'Status_foto' => 'Menunggu']);
        $row = $this->json($this->getApi('presensi', $this->token('ADM', 'admin')))[0];

        $this->assertIsInt($row['id']);
        $this->assertIsFloat($row['latitude']);
        $this->assertIsFloat($row['akurasiMeter']);
        $this->assertIsBool($row['otomatis']);
        $this->assertNull($row['dikoreksiOleh']);
        $this->assertSame('Menunggu', $row['statusFoto']);
        $this->assertMatchesRegularExpression('/^\d{2}:\d{2}$/', $row['waktu']);
    }
}
