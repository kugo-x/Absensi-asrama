<?php

namespace Tests\Feature\Modul3;

require_once __DIR__ . '/Modul3TestCase.php';

/**
 * POST /api/presensi/validasi-foto — validasi foto presensi oleh fasil PJ gedung
 *
 * @internal
 */
final class ValidasiFotoTest extends Modul3TestCase
{
    private int $id;

    protected function setUp(): void
    {
        parent::setUp();
        $this->id = $this->presensi(['NIM' => 'PNG1', 'Foto_wajah' => 'uji_validasi.jpg', 'Status_foto' => 'Menunggu', 'Keterangan' => 'Hadir via Web']);
    }

    public function testDiterima(): void
    {
        $r = $this->postApi('presensi/validasi-foto', ['id' => $this->id, 'status' => 'Diterima', 'catatan' => ''], $this->token('FAS1', 'fasil'));

        $r->assertStatus(200);
        $row = $this->barisPresensi('PNG1');
        $this->assertSame('Diterima', $row['Status_foto']);
        $this->assertSame('Hadir', $row['Status'], 'foto diterima tidak mengubah status kehadiran');
        $this->assertSame('FAS1', $row['Divalidasi_oleh']);
        $this->assertNotNull($row['Divalidasi_pada']);
        $this->assertNull($row['Catatan_validasi']);
    }

    public function testDitolakDenganCatatanMenjadiTidakHadir(): void
    {
        $r = $this->postApi('presensi/validasi-foto', ['id' => $this->id, 'status' => 'Ditolak', 'catatan' => 'Wajah tidak terlihat'], $this->token('FAS1', 'fasil'));

        $r->assertStatus(200);
        $row = $this->barisPresensi('PNG1');
        $this->assertSame('Ditolak', $row['Status_foto']);
        $this->assertSame('Tidak Hadir', $row['Status']);
        $this->assertSame('Wajah tidak terlihat', $row['Catatan_validasi']);
        $this->assertSame('FAS1', $row['Dikoreksi_oleh']);
        $this->assertSame('Foto ditolak: Wajah tidak terlihat', $row['Keterangan']);
    }

    public function testDitolakTanpaCatatanDitolak400(): void
    {
        $r = $this->postApi('presensi/validasi-foto', ['id' => $this->id, 'status' => 'Ditolak', 'catatan' => '  '], $this->token('FAS1', 'fasil'));

        $r->assertStatus(400);
        $this->assertSame('Menunggu', $this->barisPresensi('PNG1')['Status_foto']);
    }

    public function testFasilBukanPjDitolak403(): void
    {
        $this->postApi('presensi/validasi-foto', ['id' => $this->id, 'status' => 'Diterima'], $this->token('FAS2', 'fasil'))->assertStatus(403);
        $this->assertSame('Menunggu', $this->barisPresensi('PNG1')['Status_foto']);
    }

    public function testPenghuniDanAdminDitolak403(): void
    {
        $this->postApi('presensi/validasi-foto', ['id' => $this->id, 'status' => 'Diterima'], $this->token('PNG1', 'penghuni'))->assertStatus(403);
        $this->postApi('presensi/validasi-foto', ['id' => $this->id, 'status' => 'Diterima'], $this->token('ADM', 'admin'))->assertStatus(403);
    }

    public function testIdTidakAdaDitolak404(): void
    {
        $this->postApi('presensi/validasi-foto', ['id' => 999999, 'status' => 'Diterima'], $this->token('FAS1', 'fasil'))->assertStatus(404);
    }

    public function testSudahDivalidasiDitolak409(): void
    {
        $t = $this->token('FAS1', 'fasil');
        $this->postApi('presensi/validasi-foto', ['id' => $this->id, 'status' => 'Diterima'], $t)->assertStatus(200);
        $this->postApi('presensi/validasi-foto', ['id' => $this->id, 'status' => 'Ditolak', 'catatan' => 'x'], $t)->assertStatus(409);
        $this->assertSame('Diterima', $this->barisPresensi('PNG1')['Status_foto']);
    }

    public function testBarisTanpaFotoDitolak400(): void
    {
        $id = $this->presensi(['NIM' => 'PNG2', 'Status_foto' => null, 'Dikoreksi_oleh' => 'FAS1', 'Keterangan' => 'koreksi']);
        $this->postApi('presensi/validasi-foto', ['id' => $id, 'status' => 'Diterima'], $this->token('FAS1', 'fasil'))->assertStatus(400);
    }

    public function testStatusTidakValidDitolak400(): void
    {
        $this->postApi('presensi/validasi-foto', ['id' => $this->id, 'status' => 'Mungkin'], $this->token('FAS1', 'fasil'))->assertStatus(400);
    }

    public function testFieldValidasiDikembalikanGetPresensiCamelCase(): void
    {
        $this->postApi('presensi/validasi-foto', ['id' => $this->id, 'status' => 'Ditolak', 'catatan' => 'Buram'], $this->token('FAS1', 'fasil'))->assertStatus(200);
        $data = $this->json($this->getApi('presensi', $this->token('PNG1', 'penghuni')));

        $this->assertCount(1, $data);
        $this->assertSame('Ditolak', $data[0]['statusFoto']);
        $this->assertSame('Buram', $data[0]['catatanValidasi']);
        $this->assertSame('FAS1', $data[0]['divalidasiOleh']);
        $this->assertSame('Fasil Satu', $data[0]['namaValidator']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $data[0]['divalidasiPada']);
    }
}
