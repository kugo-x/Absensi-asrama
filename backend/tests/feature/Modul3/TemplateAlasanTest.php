<?php

namespace Tests\Feature\Modul3;

require_once __DIR__ . '/Modul3TestCase.php';

/**
 * Template alasan validasi foto: dibaca admin & fasil, hanya admin yang boleh mengubah.
 *
 * @internal
 */
final class TemplateAlasanTest extends Modul3TestCase
{
    private function daftar(string $nim = 'FAS1', string $peran = 'fasil'): array
    {
        return $this->json($this->getApi('template-alasan', $this->token($nim, $peran)));
    }

    public function testNilaiBawaanTersediaUntukFasilDanAdmin(): void
    {
        $fasil = $this->daftar();
        $this->assertNotEmpty(array_filter($fasil, static fn ($t) => $t['status'] === 'Diterima'));
        $this->assertNotEmpty(array_filter($fasil, static fn ($t) => $t['status'] === 'Ditolak'));
        $this->assertSame($fasil, $this->daftar('ADM', 'admin'));
    }

    public function testPenghuniTidakBolehMembaca(): void
    {
        $this->getApi('template-alasan', $this->token('PNG1', 'penghuni'))->assertStatus(403);
    }

    public function testAdminMenggantiDaftarSesuaiUrutan(): void
    {
        $r = $this->postApi('template-alasan', ['daftar' => [
            ['status' => 'Ditolak', 'teks' => '  Foto   miring  '],
            ['status' => 'Diterima', 'teks' => 'Sesuai'],
            ['status' => 'Ditolak', 'teks' => 'Wajah gelap'],
        ]], $this->token('ADM', 'admin'));
        $this->assertTrue($r->isOK(), $this->pesan($r));

        $hasil = $this->daftar();
        $this->assertSame(['Sesuai', 'Foto miring', 'Wajah gelap'], array_column($hasil, 'teks'));
    }

    public function testHanyaAdminYangBolehMengubah(): void
    {
        $body = ['daftar' => [['status' => 'Ditolak', 'teks' => 'Coba']]];
        $this->postApi('template-alasan', $body, $this->token('FAS1', 'fasil'))->assertStatus(403);
        $this->postApi('template-alasan', $body, $this->token('PNG1', 'penghuni'))->assertStatus(403);
        $this->assertNotContains('Coba', array_column($this->daftar(), 'teks'));
    }

    public function testValidasiIsi(): void
    {
        $admin = $this->token('ADM', 'admin');
        $sebelum = $this->daftar();
        $this->postApi('template-alasan', ['daftar' => [['status' => 'Lain', 'teks' => 'Teks']]], $admin)->assertStatus(400);
        $this->postApi('template-alasan', ['daftar' => [['status' => 'Ditolak', 'teks' => 'ab']]], $admin)->assertStatus(400);
        $this->postApi('template-alasan', ['daftar' => [['status' => 'Ditolak', 'teks' => 'Sama'], ['status' => 'Ditolak', 'teks' => 'sama']]], $admin)->assertStatus(400);
        $this->postApi('template-alasan', ['daftar' => 'bukan larik'], $admin)->assertStatus(400);
        $this->assertSame($sebelum, $this->daftar(), 'Daftar tidak berubah bila isian ditolak');
    }
}
