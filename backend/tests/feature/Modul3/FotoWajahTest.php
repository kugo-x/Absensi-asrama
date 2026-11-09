<?php

namespace Tests\Feature\Modul3;

use CodeIgniter\Exceptions\PageNotFoundException;
use CodeIgniter\HTTP\Exceptions\BadRequestException;

require_once __DIR__ . '/Modul3TestCase.php';

/**
 * GET /api/presensi/foto/{nama} — foto wajah presensi (data pribadi)
 *
 * @internal
 */
final class FotoWajahTest extends Modul3TestCase
{
    private const NAMA = 'UJI_foto_valid.jpg';

    protected function setUp(): void
    {
        parent::setUp();
        $dir = WRITEPATH . 'uploads/wajah/';
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $data = base64_decode(substr($this->foto(), strlen('data:image/jpeg;base64,')), true);
        file_put_contents($dir . self::NAMA, $data);
        $this->presensi(['NIM' => 'PNG1', 'Foto_wajah' => self::NAMA, 'Status_foto' => 'Menunggu']);
    }

    public function testPemilikMendapatFoto200(): void
    {
        $r = $this->getApi('presensi/foto/' . self::NAMA, $this->token('PNG1', 'penghuni'));

        $r->assertStatus(200);
        $this->assertStringStartsWith('image/jpeg', $r->response()->getHeaderLine('Content-Type'));
        $this->assertNotFalse(@getimagesizefromstring((string) $r->response()->getBody()), 'isi respons adalah gambar');
    }

    public function testFasilPjDanAdminMendapatFoto200(): void
    {
        $this->getApi('presensi/foto/' . self::NAMA, $this->token('FAS1', 'fasil'))->assertStatus(200);
        $this->getApi('presensi/foto/' . self::NAMA, $this->token('ADM', 'admin'))->assertStatus(200);
    }

    public function testPenghuniLainDanFasilLainDitolak404(): void
    {
        $this->getApi('presensi/foto/' . self::NAMA, $this->token('PNG2', 'penghuni'))->assertStatus(404);
        $this->getApi('presensi/foto/' . self::NAMA, $this->token('FAS2', 'fasil'))->assertStatus(404);
    }

    public function testBerkasTidakAda404(): void
    {
        $this->getApi('presensi/foto/tidak_ada_123.jpg', $this->token('ADM', 'admin'))->assertStatus(404);
    }

    public function testPathTraversalDitolak404(): void
    {
        $t = $this->token('ADM', 'admin');
        foreach (['..%2F..%2F.env', '....jpg', 'skrip.php', '..%5C..%5Capp%5CConfig%5CDatabase.php'] as $nama) {
            $this->assertDitolak404('presensi/foto/' . $nama, $t);
        }
    }

    /**
     * Permintaan berkas harus DITOLAK, dalam salah satu bentuk:
     * - 404 dari controller (nama berkas tidak lolos pola aman), atau
     * - tidak ada route yang cocok ("%2F" didekode router menjadi path lain) → 404, atau
     * - karakter URI terlarang (mis. backslash) → 400 dari router.
     * Pada mode tes CodeIgniter melempar exception untuk dua kasus terakhir (di HTTP sungguhan
     * keduanya menjadi respons 404/400) — tak satu pun sampai membaca berkas.
     */
    private function assertDitolak404(string $path, string $token): void
    {
        try {
            $this->getApi($path, $token)->assertStatus(404);
        } catch (PageNotFoundException|BadRequestException) {
            $this->addToAssertionCount(1);
        }
    }

    public function testTanpaTokenDitolak401(): void
    {
        $this->getApi('presensi/foto/' . self::NAMA)->assertStatus(401);
    }
}
