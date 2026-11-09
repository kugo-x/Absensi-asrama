<?php

namespace Tests\Feature\Modul3;

require_once __DIR__ . '/Modul3TestCase.php';

/**
 * POST /api/presensi/koreksi — koreksi manual oleh fasil PJ gedung
 *
 * @internal
 */
final class KoreksiTest extends Modul3TestCase
{
    private function body(array $ubah = []): array
    {
        return array_merge(['nim' => 'PNG1', 'tanggal' => date('Y-m-d'), 'sesi' => 'Uji', 'status' => 'Hadir', 'keterangan' => 'GPS bermasalah, dicek langsung'], $ubah);
    }

    public function testPjGedungBerhasilMembuatBaris(): void
    {
        $r = $this->postApi('presensi/koreksi', $this->body(), $this->token('FAS1', 'fasil'));

        $r->assertStatus(200);
        $row = $this->barisPresensi('PNG1');
        $this->assertSame('Hadir', $row['Status']);
        $this->assertSame('FAS1', $row['Dikoreksi_oleh']);
        $this->assertSame('GPS bermasalah, dicek langsung', $row['Keterangan']);
        $this->assertNull($row['Status_foto'], 'baris koreksi tanpa foto tidak masuk antrean validasi');
    }

    public function testPjGedungMemperbaruiBarisYangAdaTanpaDuplikat(): void
    {
        $this->presensi(['NIM' => 'PNG1', 'Status' => 'Tidak Hadir', 'Keterangan' => 'Otomatis oleh sistem']);
        $this->postApi('presensi/koreksi', $this->body(['status' => 'Izin']), $this->token('FAS1', 'fasil'))->assertStatus(200);

        $this->assertSame(1, $this->db->table('presensi')->where('NIM', 'PNG1')->countAllResults());
        $this->assertSame('Izin', $this->barisPresensi('PNG1')['Status']);
    }

    public function testKorektorDiambilDariTokenBukanBody(): void
    {
        $this->postApi('presensi/koreksi', $this->body(['korektorNim' => 'ADM']), $this->token('FAS1', 'fasil'))->assertStatus(200);
        $this->assertSame('FAS1', $this->barisPresensi('PNG1')['Dikoreksi_oleh']);
    }

    public function testFasilBukanPjDitolak403(): void
    {
        $r = $this->postApi('presensi/koreksi', $this->body(), $this->token('FAS2', 'fasil'));

        $r->assertStatus(403);
        $this->assertNull($this->barisPresensi('PNG1'));
    }

    public function testPenghuniDitolak403(): void
    {
        $this->postApi('presensi/koreksi', $this->body(), $this->token('PNG2', 'penghuni'))->assertStatus(403);
    }

    public function testTanpaTokenDitolak401(): void
    {
        $this->postApi('presensi/koreksi', $this->body())->assertStatus(401);
    }

    public function testTanggalYangAkanDatangDitolak400(): void
    {
        $r = $this->postApi('presensi/koreksi', $this->body(['tanggal' => date('Y-m-d', strtotime('+1 day'))]), $this->token('FAS1', 'fasil'));

        $r->assertStatus(400);
        $this->assertStringContainsString('akan datang', $this->pesan($r));
    }

    public function testKeteranganKosongDitolak400(): void
    {
        $this->postApi('presensi/koreksi', $this->body(['keterangan' => '   ']), $this->token('FAS1', 'fasil'))->assertStatus(400);
    }

    public function testStatusTidakValidDitolak400(): void
    {
        $this->postApi('presensi/koreksi', $this->body(['status' => 'Bolos']), $this->token('FAS1', 'fasil'))->assertStatus(400);
    }
}
