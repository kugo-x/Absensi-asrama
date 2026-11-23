<?php

namespace Tests\Feature\Modul3;

require_once __DIR__ . '/Modul3TestCase.php';

/**
 * Pengumuman: hak kirim per peran, cakupan gedung, kedaluwarsa, ubah/hapus milik sendiri.
 *
 * @internal
 */
final class PengumumanTest extends Modul3TestCase
{
    private function daftar(string $nim, string $role): array
    {
        $j = $this->json($this->getApi('pengumuman', $this->token($nim, $role)));

        return array_column($j['data'] ?? $j, 'judul');
    }

    private function kirim(array $body, string $nim, string $role)
    {
        return $this->postApi('pengumuman/add', array_merge(['isi' => 'Isi pengumuman uji.'], $body), $this->token($nim, $role));
    }

    public function testPenghuniTidakBolehMengirim(): void
    {
        $this->kirim(['judul' => 'Halo semua'], 'PNG1', 'penghuni')->assertStatus(403);
        $this->assertSame(0, $this->db->table('pengumuman')->countAllResults());
    }

    public function testCakupanAdminSeluruhDanGedung(): void
    {
        $this->assertTrue($this->kirim(['judul' => 'Untuk semua', 'tipe' => 'seluruh'], 'ADM', 'admin')->isOK());
        $this->assertTrue($this->kirim(['judul' => 'Khusus gedung B', 'tipe' => 'gedung', 'idGedung' => 2], 'ADM', 'admin')->isOK());
        $this->kirim(['judul' => 'Tanpa gedung', 'tipe' => 'gedung'], 'ADM', 'admin')->assertStatus(400);

        // PNG1 di gedung A: hanya melihat yang untuk semua; PNG3 di gedung B: keduanya
        $this->assertSame(['Untuk semua'], $this->daftar('PNG1', 'penghuni'));
        $this->assertEqualsCanonicalizing(['Untuk semua', 'Khusus gedung B'], $this->daftar('PNG3', 'penghuni'));
        $this->assertCount(2, $this->daftar('ADM', 'admin'));
    }

    public function testFasilHanyaKeGedungBinaannya(): void
    {
        // Fasil mencoba mengirim ke seluruh asrama / gedung lain -> dipaksa ke gedung binaannya
        $this->assertTrue($this->kirim(['judul' => 'Rapat penghuni A', 'tipe' => 'seluruh', 'idGedung' => 2], 'FAS1', 'fasil')->isOK());
        $row = $this->db->table('pengumuman')->get()->getRowArray();
        $this->assertSame('gedung', $row['tipe']);
        $this->assertSame(1, (int) $row['id_gedung']);

        $this->assertSame(['Rapat penghuni A'], $this->daftar('PNG1', 'penghuni'));
        $this->assertSame([], $this->daftar('PNG3', 'penghuni'));
        // Fasil gedung lain tidak melihatnya
        $this->assertSame([], $this->daftar('FAS2', 'fasil'));
    }

    public function testKedaluwarsaTidakTampilKePenghuni(): void
    {
        $this->kirim(['judul' => 'Lewat tanggal', 'berlakuSampai' => date('Y-m-d', strtotime('-1 day'))], 'ADM', 'admin')->assertStatus(400);
        $this->kirim(['judul' => 'Masih berlaku', 'berlakuSampai' => date('Y-m-d')], 'ADM', 'admin');
        $this->db->table('pengumuman')->insert([
            'judul' => 'Sudah lewat', 'isi' => 'x', 'penting' => 0, 'tipe' => 'seluruh', 'berlaku_sampai' => date('Y-m-d', strtotime('-2 day')),
            'created_by' => 'ADM', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $this->assertSame(['Masih berlaku'], $this->daftar('PNG1', 'penghuni'));
        // Admin tetap melihat semuanya (untuk dikelola)
        $this->assertCount(2, $this->daftar('ADM', 'admin'));
    }

    public function testUbahHapusHanyaPembuatAtauAdmin(): void
    {
        $this->kirim(['judul' => 'Milik fasil A', 'penting' => true], 'FAS1', 'fasil');
        $id = (int) $this->db->table('pengumuman')->get()->getRow()->id;

        $this->postApi('pengumuman/update', ['id' => $id, 'judul' => 'Diubah fasil B'], $this->token('FAS2', 'fasil'))->assertStatus(403);
        $this->postApi('pengumuman/update', ['id' => $id, 'judul' => 'Diubah pemilik'], $this->token('FAS1', 'fasil'))->assertStatus(200);
        $row = $this->db->table('pengumuman')->where('id', $id)->get()->getRowArray();
        $this->assertSame('Diubah pemilik', $row['judul']);
        $this->assertSame(1, (int) $row['penting']);

        $this->postApi('pengumuman/delete', ['id' => $id], $this->token('PNG1', 'penghuni'))->assertStatus(403);
        $this->postApi('pengumuman/delete', ['id' => $id], $this->token('ADM', 'admin'))->assertStatus(200);
        $this->assertSame(0, $this->db->table('pengumuman')->countAllResults());
    }

    public function testValidasiIsian(): void
    {
        $this->kirim(['judul' => 'ab'], 'ADM', 'admin')->assertStatus(400);
        $this->postApi('pengumuman/add', ['judul' => 'Judul cukup', 'isi' => ''], $this->token('ADM', 'admin'))->assertStatus(400);
        $this->getApi('pengumuman')->assertStatus(401);
    }
}
