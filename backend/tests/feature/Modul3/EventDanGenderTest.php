<?php

namespace Tests\Feature\Modul3;
require_once __DIR__ . '/Modul3TestCase.php';

/**
 * Validasi foto absen event, absen ulang setelah ditolak, libur mematikan absen event,
 * rekap event, aturan gender gedung/penghuni, dan edit hari libur.
 *
 * @internal
 */
final class EventDanGenderTest extends Modul3TestCase
{
    private function eventHariIni(array $ubah = []): int
    {
        $this->db->table('event')->insert(array_merge([
            'judul' => 'Event Uji', 'tipe' => 'seluruh', 'id_gedung' => null, 'tanggal' => date('Y-m-d'),
            'jam_mulai' => '00:00:01', 'jam_selesai' => '23:59:58', 'lokasi' => 'Aula',
            'latitude' => self::LAT, 'longitude' => self::LNG, 'radius_meter' => 100,
            'created_by' => 'ADM', 'created_at' => self::DIBUAT, 'updated_at' => self::DIBUAT,
        ], $ubah));

        return (int) $this->db->insertID();
    }

    private function absen(int $idEvent, string $nim = 'PNG1')
    {
        return $this->postApi('event/absen', ['idEvent' => $idEvent, 'latitude' => self::LAT, 'longitude' => self::LNG, 'foto' => $this->foto()], $this->token($nim, 'penghuni'));
    }

    private function barisEvent(int $idEvent, string $nim = 'PNG1'): ?array
    {
        return $this->db->table('presensi_event')->where('id_event', $idEvent)->where('nim', $nim)->get()->getRowArray();
    }

    protected function tearDown(): void
    {
        // Berkas sampul yang dibuat tes (writable/ dipakai bersama dev)
        if ($this->db->tableExists('event') && $this->db->fieldExists('foto_sampul', 'event')) {
            foreach ($this->db->table('event')->select('foto_sampul')->where('foto_sampul IS NOT NULL', null, false)->get()->getResultArray() as $r) {
                $berkas = WRITEPATH . 'uploads/event_sampul/' . $r['foto_sampul'];
                if (is_file($berkas)) {
                    unlink($berkas);
                }
            }
        }
        if ($this->db->tableExists('presensi_event')) {
            foreach ($this->db->table('presensi_event')->select('foto')->get()->getResultArray() as $r) {
                $berkas = WRITEPATH . 'uploads/event/' . $r['foto'];
                if ($r['foto'] && is_file($berkas)) {
                    unlink($berkas);
                }
            }
        }
        parent::tearDown();
    }

    // ------------------------------------------------------------ event

    public function testAbsenEventMenungguValidasiLaluMasukDaftarFasilGedungnya(): void
    {
        $id = $this->eventHariIni();
        $this->absen($id)->assertStatus(200);

        $row = $this->barisEvent($id);
        $this->assertSame('Hadir', $row['status']);
        $this->assertSame('Menunggu', $row['Status_foto']);

        $fas1 = $this->json($this->getApi('event/foto-validasi', $this->token('FAS1', 'fasil')));
        $this->assertContains('PNG1', array_column($fas1['data'] ?? $fas1, 'nim'));
        // FAS2 bukan PJ gedung PNG1
        $fas2 = $this->json($this->getApi('event/foto-validasi', $this->token('FAS2', 'fasil')));
        $this->assertNotContains('PNG1', array_column($fas2['data'] ?? $fas2, 'nim'));
        // Admin melihat semua gedung (untuk hitungan dashboard); penghuni tidak boleh
        $adm = $this->json($this->getApi('event/foto-validasi', $this->token('ADM', 'admin')));
        $this->assertContains('PNG1', array_column($adm['data'] ?? $adm, 'nim'));
        $this->getApi('event/foto-validasi', $this->token('PNG1', 'penghuni'))->assertStatus(403);
        // Validasi tetap hanya oleh fasil
        $this->postApi('event/validasi-foto', ['id' => (int) $this->barisEvent($id)['id'], 'status' => 'Diterima', 'catatan' => ''], $this->token('ADM', 'admin'))->assertStatus(403);
    }

    public function testFotoEventDitolakLaluAbsenUlang(): void
    {
        $id = $this->eventHariIni();
        $this->absen($id)->assertStatus(200);
        $idPresensi = (int) $this->barisEvent($id)['id'];

        // Fasil gedung lain ditolak, tolak tanpa catatan ditolak
        $this->postApi('event/validasi-foto', ['id' => $idPresensi, 'status' => 'Ditolak', 'catatan' => 'x'], $this->token('FAS2', 'fasil'))->assertStatus(403);
        $this->postApi('event/validasi-foto', ['id' => $idPresensi, 'status' => 'Ditolak', 'catatan' => ''], $this->token('FAS1', 'fasil'))->assertStatus(400);

        $this->postApi('event/validasi-foto', ['id' => $idPresensi, 'status' => 'Ditolak', 'catatan' => 'buram'], $this->token('FAS1', 'fasil'))->assertStatus(200);
        $row = $this->barisEvent($id);
        $this->assertSame('Tidak Hadir', $row['status']);
        $this->assertSame('Ditolak', $row['Status_foto']);
        // Sudah divalidasi -> tidak bisa divalidasi lagi
        $this->postApi('event/validasi-foto', ['id' => $idPresensi, 'status' => 'Diterima', 'catatan' => ''], $this->token('FAS1', 'fasil'))->assertStatus(409);

        // Absen ulang selama event berlangsung
        $this->absen($id)->assertStatus(200);
        $row = $this->barisEvent($id);
        $this->assertSame('Hadir', $row['status']);
        $this->assertSame('Menunggu', $row['Status_foto']);
        $this->assertSame(1, $this->db->table('presensi_event')->where('id_event', $id)->where('nim', 'PNG1')->countAllResults());

        // Setelah diterima, absen lagi ditolak
        $this->postApi('event/validasi-foto', ['id' => (int) $row['id'], 'status' => 'Diterima', 'catatan' => ''], $this->token('FAS1', 'fasil'))->assertStatus(200);
        $this->absen($id)->assertStatus(400);
    }

    public function testAbsenEventDitolakSaatHariLibur(): void
    {
        $this->libur(date('Y-m-d'), date('Y-m-d'));
        $id = $this->eventHariIni();

        $r = $this->absen($id);
        $r->assertStatus(400);
        $this->assertStringContainsString('libur', $this->pesan($r));
        $this->assertNull($this->barisEvent($id));
    }

    public function testRekapEventMemuatPenghuniYangSudahAbsen(): void
    {
        $id = $this->eventHariIni();
        $this->absen($id)->assertStatus(200);

        $j = $this->json($this->getApi('event/rekap/' . $id, $this->token('ADM', 'admin')));
        $rekap = $j['data'] ?? $j;
        $peserta = array_column($rekap['peserta'], null, 'nim');
        $this->assertArrayHasKey('PNG1', $peserta);
        $this->assertSame('Hadir', $peserta['PNG1']['status']);
        $this->assertSame('Menunggu', $peserta['PNG1']['statusFoto']);
        $this->assertSame(1, $rekap['statistik']['hadir']);
    }

    // ------------------------------------------------------------ foto sampul event

    private function sampulDb(int $id): ?string
    {
        return $this->db->table('event')->where('id', $id)->get()->getRow()->foto_sampul;
    }

    public function testFotoSampulEventSimpanGantiHapus(): void
    {
        $admin = $this->token('ADM', 'admin');
        $dasar = ['judul' => 'Event Bersampul', 'tipe' => 'seluruh', 'tanggal' => date('Y-m-d'), 'jamMulai' => '08:00', 'jamSelesai' => '09:00', 'lokasi' => 'Aula', 'latitude' => self::LAT, 'longitude' => self::LNG, 'radiusMeter' => 50];

        // Bukan gambar -> ditolak
        $this->postApi('event/add', $dasar + ['fotoSampul' => 'data:image/png;base64,' . base64_encode(str_repeat('x', 500))], $admin)->assertStatus(400);

        $r = $this->postApi('event/add', $dasar + ['fotoSampul' => $this->foto()], $admin);
        $this->assertTrue($r->isOK());
        $id = (int) $this->json($r)['id'];
        $lama = $this->sampulDb($id);
        $this->assertNotNull($lama);
        $this->assertFileExists(WRITEPATH . 'uploads/event_sampul/' . $lama);

        // Penghuni bisa melihat sampul; daftar event memuat nama berkasnya
        $this->getApi('event/sampul/' . $lama, $this->token('PNG1', 'penghuni'))->assertStatus(200);
        $daftar = $this->json($this->getApi('event', $this->token('PNG1', 'penghuni')));
        $ev = array_values(array_filter($daftar['data'] ?? $daftar, static fn ($e) => (int) $e['id'] === $id))[0];
        $this->assertSame($lama, $ev['fotoSampul']);

        // Ganti: berkas lama dihapus
        $this->postApi('event/update', ['id' => $id, 'fotoSampul' => $this->foto()], $admin)->assertStatus(200);
        $baru = $this->sampulDb($id);
        $this->assertNotSame($lama, $baru);
        $this->assertFileDoesNotExist(WRITEPATH . 'uploads/event_sampul/' . $lama);

        // Update tanpa fotoSampul: tetap
        $this->postApi('event/update', ['id' => $id, 'judul' => 'Ganti Judul'], $admin)->assertStatus(200);
        $this->assertSame($baru, $this->sampulDb($id));

        // Hapus sampul
        $this->postApi('event/update', ['id' => $id, 'hapusSampul' => true], $admin)->assertStatus(200);
        $this->assertNull($this->sampulDb($id));
        $this->assertFileDoesNotExist(WRITEPATH . 'uploads/event_sampul/' . $baru);
    }

    public function testHapusEventIkutMenghapusBerkasSampul(): void
    {
        $admin = $this->token('ADM', 'admin');
        $r = $this->postApi('event/add', ['judul' => 'Sementara', 'tipe' => 'seluruh', 'tanggal' => date('Y-m-d'), 'jamMulai' => '08:00', 'jamSelesai' => '09:00', 'lokasi' => 'Aula', 'latitude' => self::LAT, 'longitude' => self::LNG, 'radiusMeter' => 50, 'fotoSampul' => $this->foto()], $admin);
        $id = (int) $this->json($r)['id'];
        $berkas = WRITEPATH . 'uploads/event_sampul/' . $this->sampulDb($id);
        $this->assertFileExists($berkas);

        $this->postApi('event/delete', ['id' => $id], $admin)->assertStatus(200);
        $this->assertFileDoesNotExist($berkas);
    }

    // ------------------------------------------------------------ gender

    public function testTambahGedungWajibJenisDanPjSesuaiGender(): void
    {
        $this->db->table('user')->whereIn('NIM', ['FAS1', 'PNG1', 'PNG2'])->update(['Jenis_kelamin' => 'L']);
        $admin = $this->token('ADM', 'admin');
        $dasar = ['nama' => 'Gedung Baru', 'latitude' => self::LAT, 'longitude' => self::LNG, 'radiusMeter' => 50];

        $this->postApi('gedung/add', $dasar, $admin)->assertStatus(400);
        $r = $this->postApi('gedung/add', $dasar + ['jenis' => 'Putri', 'nimPj' => 'FAS1'], $admin);
        $r->assertStatus(400);
        $this->assertTrue($this->postApi('gedung/add', $dasar + ['jenis' => 'Putri'], $admin)->isOK());
        $this->assertSame('Putri', $this->db->table('gedung')->where('Nama', 'Gedung Baru')->get()->getRow()->Jenis);

        // Gedung yang dihuni laki-laki tidak bisa diubah menjadi Putri
        $this->postApi('gedung/update', ['id' => 1, 'nama' => 'Gedung Uji A', 'jenis' => 'Putri', 'latitude' => self::LAT, 'longitude' => self::LNG, 'radiusMeter' => 50], $admin)->assertStatus(400);
    }

    public function testPenghuniBaruHarusSesuaiJenisGedungKamar(): void
    {
        $admin = $this->token('ADM', 'admin');
        $dasar = ['nim' => 'BARU1', 'nama' => 'Penghuni Baru', 'email' => '', 'noHp' => '', 'asal' => '', 'nomorKamar' => 'A-101'];

        $this->postApi('penghuni', $dasar, $admin)->assertStatus(400);
        $this->postApi('penghuni', $dasar + ['jenisKelamin' => 'P'], $admin)->assertStatus(400);
        $this->assertTrue($this->postApi('penghuni', $dasar + ['jenisKelamin' => 'L'], $admin)->isOK());
        $this->assertSame('L', $this->db->table('user')->where('NIM', 'BARU1')->get()->getRow()->Jenis_kelamin);
    }

    // ------------------------------------------------------------ libur

    public function testEditHariLiburHanyaAdmin(): void
    {
        $this->libur('2026-12-24', '2026-12-25');
        $id = (int) $this->db->table('hari_libur')->get()->getRow()->Id_libur;
        $body = ['id' => $id, 'tanggalMulai' => '2026-12-24', 'tanggalSelesai' => '2026-12-26', 'keterangan' => 'Natal'];

        $this->postApi('libur/update', $body, $this->token('FAS1', 'fasil'))->assertStatus(403);
        $this->postApi('libur/update', $body, $this->token('ADM', 'admin'))->assertStatus(200);
        $row = $this->db->table('hari_libur')->where('Id_libur', $id)->get()->getRow();
        $this->assertSame('2026-12-26', $row->Tanggal_selesai);
        $this->assertSame('Natal', $row->Keterangan);
        $this->postApi('libur/update', array_merge($body, ['tanggalSelesai' => '2026-12-01']), $this->token('ADM', 'admin'))->assertStatus(400);
    }
}
