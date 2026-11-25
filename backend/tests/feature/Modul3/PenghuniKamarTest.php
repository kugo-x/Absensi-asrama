<?php

namespace Tests\Feature\Modul3;

require_once __DIR__ . '/Modul3TestCase.php';

/**
 * Penghuni boleh tanpa kamar: didaftarkan dulu, ditempatkan belakangan.
 * Pindah kamar harus lewat "keluarkan dari kamar" lalu "tempatkan" (tidak boleh langsung).
 *
 * @internal
 */
final class PenghuniKamarTest extends Modul3TestCase
{
    private function ubah(string $nim, array $isi, string $oleh = 'ADM', string $peran = 'admin')
    {
        return $this->postApi('penghuni/update', array_merge(['nim' => $nim, 'role' => 'penghuni', 'statusAktif' => true], $isi), $this->token($oleh, $peran));
    }

    private function kamar(string $nim): ?string
    {
        return $this->db->table('user')->where('NIM', $nim)->get()->getRow()->Nomor_kamar;
    }

    public function testTambahPenghuniTanpaKamar(): void
    {
        $r = $this->postApi('penghuni', ['nim' => 'BARU2', 'nama' => 'Belum Berkamar', 'jenisKelamin' => 'L'], $this->token('ADM', 'admin'));
        $this->assertTrue($r->isOK(), $this->pesan($r));
        $u = $this->db->table('user')->where('NIM', 'BARU2')->get()->getRowArray();
        $this->assertNull($u['Nomor_kamar']);
        $this->assertSame('Aktif', $u['Status_aktif']);
    }

    public function testHanyaAdminYangBolehMenambahDanMengubah(): void
    {
        $this->postApi('penghuni', ['nim' => 'BARU3', 'nama' => 'X', 'jenisKelamin' => 'L'], $this->token('FAS1', 'fasil'))->assertStatus(403);
        $this->postApi('penghuni', ['nim' => 'BARU3', 'nama' => 'X', 'jenisKelamin' => 'L'], $this->token('PNG1', 'penghuni'))->assertStatus(403);
        $this->ubah('PNG2', ['nomorKamar' => null], 'PNG1', 'penghuni')->assertStatus(403);
        $this->postApi('penghuni/toggle-status', ['nim' => 'PNG2'], $this->token('FAS1', 'fasil'))->assertStatus(403);
        $this->assertSame('A-101', $this->kamar('PNG2'));
    }

    public function testPindahKamarLangsungDitolak(): void
    {
        $r = $this->ubah('PNG1', ['nomorKamar' => 'B-101']);
        $r->assertStatus(409);
        $this->assertStringContainsString('Keluarkan dulu', $this->pesan($r));
        $this->assertSame('A-101', $this->kamar('PNG1'));
    }

    public function testKeluarkanDariKamarLaluTempatkanDiKamarLain(): void
    {
        // 1. Keluarkan dari kamar: tetap aktif, tanpa kamar
        $this->ubah('PNG1', ['nomorKamar' => null])->assertStatus(200);
        $u = $this->db->table('user')->where('NIM', 'PNG1')->get()->getRowArray();
        $this->assertNull($u['Nomor_kamar']);
        $this->assertSame('Aktif', $u['Status_aktif']);

        // 2. Tempatkan di kamar baru
        $this->ubah('PNG1', ['nomorKamar' => 'B-101'])->assertStatus(200);
        $this->assertSame('B-101', $this->kamar('PNG1'));
    }

    public function testMenyimpanDataTanpaMengubahKamarTetapBoleh(): void
    {
        $this->ubah('PNG1', ['nomorKamar' => 'A-101', 'nama' => 'Penghuni Satu Baru'])->assertStatus(200);
        $u = $this->db->table('user')->where('NIM', 'PNG1')->get()->getRowArray();
        $this->assertSame('A-101', $u['Nomor_kamar']);
        $this->assertSame('Penghuni Satu Baru', $u['Nama']);
    }

    public function testPenghuniTanpaKamarTidakIkutDitandaiAlpa(): void
    {
        $this->ubah('PNG1', ['nomorKamar' => null])->assertStatus(200);
        $this->sesiBuka();
        $this->postApi('presensi', $this->bodyCheckIn(), $this->token('PNG1', 'penghuni'))->assertStatus(400);
    }
}
