<?php

namespace Tests\Feature\Modul3;

use App\Libraries\PresensiService;

require_once __DIR__ . '/Modul3TestCase.php';

/**
 * Fitur tambahan Modul 3:
 *  1. Jadwal absen malam per hari (sesi_gedung_hari)
 *  2. Izin rutin berulang (izin.Hari_berulang)
 *  4. Validasi foto sekaligus (POST /api/presensi/validasi-foto-massal)
 *
 * Tanggal acuan: Senin 2 Maret 2026 (ISO 1), Selasa 3 Maret (2), Rabu 4 Maret (3).
 *
 * @internal
 */
final class FiturTambahanTest extends Modul3TestCase
{
    private function sesiGedung(int $gedung, string $mulai, string $selesai, string $oleh = 'FAS1'): int
    {
        $this->db->table('sesi_gedung')->insert([
            'Id_Gedung' => $gedung, 'Nama' => 'Malam', 'Jam_mulai' => $mulai, 'Jam_selesai' => $selesai, 'Aktif' => 1,
            'Diatur_oleh' => $oleh, 'created_at' => self::DIBUAT, 'updated_at' => self::DIBUAT,
        ]);

        return (int) $this->db->insertID();
    }

    private function hariKhusus(int $idSesi, int $hari, ?string $mulai, ?string $selesai, int $aktif = 1): void
    {
        $this->db->table('sesi_gedung_hari')->insert(['Id_sesi_gedung' => $idSesi, 'Hari' => $hari, 'Jam_mulai' => $mulai, 'Jam_selesai' => $selesai, 'Aktif' => $aktif]);
    }

    private function statusMalam(string $nim, string $tanggal): ?string
    {
        return $this->barisPresensi($nim, $tanggal, 'Malam')['Status'] ?? null;
    }

    // ================================================================ 1. jadwal per hari

    public function testSimpanJadwalPerHariMenggantiPengecualianLama(): void
    {
        $body = ['jamMulai' => '18:00', 'jamSelesai' => '20:00', 'aktif' => true, 'hari' => [
            ['hari' => 5, 'aktif' => true, 'jamMulai' => '19:00', 'jamSelesai' => '21:00'],
            ['hari' => 6, 'aktif' => false],
        ]];
        $this->postApi('sesi-gedung', $body, $this->token('FAS1', 'fasil'))->assertStatus(200);

        $rows = $this->db->table('sesi_gedung_hari')->orderBy('Hari')->get()->getResultArray();
        $this->assertCount(2, $rows);
        $this->assertSame(['5', '19:00:00', '1'], [(string) $rows[0]['Hari'], $rows[0]['Jam_mulai'], (string) $rows[0]['Aktif']]);
        $this->assertSame(['6', null, '0'], [(string) $rows[1]['Hari'], $rows[1]['Jam_mulai'], (string) $rows[1]['Aktif']]);

        // Kirim ulang tanpa Sabtu: pengecualian lama diganti seluruhnya
        $body['hari'] = [['hari' => 5, 'aktif' => true, 'jamMulai' => '19:30', 'jamSelesai' => '21:00']];
        $this->postApi('sesi-gedung', $body, $this->token('FAS1', 'fasil'))->assertStatus(200);
        $this->assertSame(1, $this->db->table('sesi_gedung_hari')->countAllResults());

        // Tanpa kunci `hari`: pengecualian dibiarkan
        unset($body['hari']);
        $this->postApi('sesi-gedung', $body, $this->token('FAS1', 'fasil'))->assertStatus(200);
        $this->assertSame(1, $this->db->table('sesi_gedung_hari')->countAllResults());

        // getSesi mengembalikan jadwalHari
        $list = $this->json($this->getApi('sesi', $this->token('PNG1', 'penghuni')));
        $malam = array_values(array_filter($list, static fn ($s) => $s['idGedung'] !== null))[0];
        $this->assertSame([['hari' => 5, 'jamMulai' => '19:30', 'jamSelesai' => '21:00', 'aktif' => true]], $malam['jadwalHari']);
    }

    public function testJadwalPerHariDivalidasi(): void
    {
        $t = $this->token('FAS1', 'fasil');
        $dasar = ['jamMulai' => '18:00', 'jamSelesai' => '20:00', 'aktif' => true];

        $this->postApi('sesi-gedung', $dasar + ['hari' => [['hari' => 8, 'aktif' => false]]], $t)->assertStatus(400);
        $this->postApi('sesi-gedung', $dasar + ['hari' => [['hari' => 1, 'aktif' => false], ['hari' => 1, 'aktif' => false]]], $t)->assertStatus(400);
        $r = $this->postApi('sesi-gedung', $dasar + ['hari' => [['hari' => 2, 'aktif' => true, 'jamMulai' => '21:00', 'jamSelesai' => '20:00']]], $t);
        $r->assertStatus(400);
        $this->assertStringContainsString('Selasa', $this->pesan($r));

        // Jam khusus juga tidak boleh menabrak sesi global
        $this->sesi('Subuh', '04:00:00', '06:00:00');
        $r = $this->postApi('sesi-gedung', $dasar + ['hari' => [['hari' => 3, 'aktif' => true, 'jamMulai' => '05:00', 'jamSelesai' => '07:00']]], $t);
        $r->assertStatus(400);
        $this->assertStringContainsString('Rabu', $this->pesan($r));
        $this->assertSame(0, $this->db->table('sesi_gedung_hari')->countAllResults());
    }

    public function testCheckInMemakaiJadwalHariIni(): void
    {
        $id = $this->sesiGedung(1, '00:00:00', '00:00:01'); // jam utama sudah lewat
        $this->hariKhusus($id, PresensiService::hariIso(date('Y-m-d')), '00:00:00', '23:59:59');

        $this->postApi('presensi', $this->bodyCheckIn(['sesi' => 'Malam']), $this->token('PNG1', 'penghuni'))->assertStatus(200);
    }

    public function testCheckInDitolakPadaHariTanpaAbsen(): void
    {
        $id = $this->sesiGedung(1, '00:00:00', '23:59:59');
        $this->hariKhusus($id, PresensiService::hariIso(date('Y-m-d')), null, null, 0);

        $r = $this->postApi('presensi', $this->bodyCheckIn(['sesi' => 'Malam']), $this->token('PNG1', 'penghuni'));
        $r->assertStatus(400);
        $this->assertStringContainsString('diliburkan', $this->pesan($r));
    }

    public function testTandaiTidakHadirMengikutiJadwalPerHari(): void
    {
        $id = $this->sesiGedung(1, '18:00:00', '20:00:00');
        $this->hariKhusus($id, 1, null, null, 0);                // Senin: tidak ada absen malam
        $this->hariKhusus($id, 2, '20:00:00', '22:00:00');       // Selasa: lebih malam
        $svc = new PresensiService($this->db);

        $svc->tandaiTidakHadir('2026-03-02', '2026-03-05 08:00:00');
        $this->assertNull($this->statusMalam('PNG1', '2026-03-02'), 'Senin diliburkan');

        // Selasa 21:00: jadwal khusus belum ditutup (22:00), padahal jam utama (20:00) sudah lewat
        $svc->tandaiTidakHadir('2026-03-03', '2026-03-03 21:00:00');
        $this->assertNull($this->statusMalam('PNG1', '2026-03-03'));
        $svc->tandaiTidakHadir('2026-03-03', '2026-03-03 22:30:00');
        $this->assertSame('Tidak Hadir', $this->statusMalam('PNG1', '2026-03-03'));
        $this->assertSame('2026-03-03 22:00:00', $this->barisPresensi('PNG1', '2026-03-03', 'Malam')['Waktu']);

        // Rabu tanpa pengecualian: jam utama
        $svc->tandaiTidakHadir('2026-03-04', '2026-03-04 20:30:00');
        $this->assertSame('Tidak Hadir', $this->statusMalam('PNG1', '2026-03-04'));
    }

    // ================================================================ 2. izin rutin

    private function ajukan(array $body, string $nim = 'PNG1')
    {
        return $this->postApi('izin', $body + ['nim' => $nim, 'alasan' => 'Kuliah malam', 'sesi' => null], $this->token($nim, 'penghuni'));
    }

    public function testIzinRutinTersimpanDanTerbaca(): void
    {
        $mulai = date('Y-m-d', strtotime('+1 day'));
        $selesai = date('Y-m-d', strtotime('+60 day'));
        $this->ajukan(['tanggal' => $mulai, 'tanggalSelesai' => $selesai, 'hariBerulang' => [4, 2, 2]])->assertStatus(201);

        $this->assertSame('2,4', $this->db->table('izin')->get()->getRowArray()['Hari_berulang']);
        $list = $this->json($this->getApi('izin', $this->token('FAS1', 'fasil')));
        $this->assertSame([2, 4], $list[0]['hariBerulang']);
    }

    public function testIzinRutinDivalidasi(): void
    {
        $besok = date('Y-m-d', strtotime('+1 day'));
        $this->ajukan(['tanggal' => $besok, 'tanggalSelesai' => $besok, 'hariBerulang' => [1]])->assertStatus(400);
        $this->ajukan(['tanggal' => $besok, 'tanggalSelesai' => date('Y-m-d', strtotime('+30 day')), 'hariBerulang' => []])->assertStatus(400);
        $this->ajukan(['tanggal' => $besok, 'tanggalSelesai' => date('Y-m-d', strtotime('+30 day')), 'hariBerulang' => [9]])->assertStatus(400);
        // Rentang 2 hari yang tidak memuat hari terpilih
        $hariBesok = (int) date('N', strtotime($besok));
        $lain = (($hariBesok + 2) % 7) + 1; // bukan besok dan bukan lusa
        $r = $this->ajukan(['tanggal' => $besok, 'tanggalSelesai' => date('Y-m-d', strtotime('+2 day')), 'hariBerulang' => [$lain]]);
        $r->assertStatus(400);
        $this->assertSame(0, $this->db->table('izin')->countAllResults());
    }

    public function testIzinRutinBerbedaHariTidakBentrok(): void
    {
        $mulai = date('Y-m-d', strtotime('+1 day'));
        $selesai = date('Y-m-d', strtotime('+60 day'));
        $this->ajukan(['tanggal' => $mulai, 'tanggalSelesai' => $selesai, 'hariBerulang' => [2]])->assertStatus(201);
        $this->ajukan(['tanggal' => $mulai, 'tanggalSelesai' => $selesai, 'hariBerulang' => [4]])->assertStatus(201);
        $this->ajukan(['tanggal' => $mulai, 'tanggalSelesai' => $selesai, 'hariBerulang' => [4, 5]])->assertStatus(409);
        // Izin biasa satu hari: bentrok hanya bila jatuh pada Selasa/Kamis
        $selasa = date('Y-m-d', strtotime('next tuesday', strtotime($mulai)));
        $senin  = date('Y-m-d', strtotime('next monday', strtotime($mulai)));
        $this->ajukan(['tanggal' => $selasa, 'tanggalSelesai' => $selasa])->assertStatus(409);
        $this->ajukan(['tanggal' => $senin, 'tanggalSelesai' => $senin])->assertStatus(201);
    }

    public function testIzinRutinHanyaBerlakuDiHariTerpilih(): void
    {
        $this->sesi('Malam', '18:00:00', '20:00:00');
        $this->db->table('izin')->insert([
            'NIM' => 'PNG1', 'Alasan' => 'Kuliah malam', 'Status_persetujuan' => 'Disetujui', 'Tanggal' => '2026-03-01',
            'Tanggal_selesai' => '2026-03-31', 'Sesi' => null, 'Hari_berulang' => '2', 'created_at' => self::DIBUAT, 'updated_at' => self::DIBUAT,
        ]);
        $svc = new PresensiService($this->db);

        $svc->tandaiTidakHadir('2026-03-02', '2026-03-05 08:00:00'); // Senin
        $svc->tandaiTidakHadir('2026-03-03', '2026-03-05 08:00:00'); // Selasa

        $this->assertSame('Tidak Hadir', $this->statusMalam('PNG1', '2026-03-02'));
        $this->assertSame('Izin', $this->statusMalam('PNG1', '2026-03-03'));
        $this->assertNotNull($svc->cariIzinDisetujui('PNG1', '2026-03-10', 'Malam'));
        $this->assertNull($svc->cariIzinDisetujui('PNG1', '2026-03-09', 'Malam'));
    }

    // ================================================================ 4. validasi foto sekaligus

    public function testTerimaSekaligusHanyaFotoMilikGedungnya(): void
    {
        $a = $this->presensi(['NIM' => 'PNG1', 'Foto_wajah' => 'm1.jpg', 'Status_foto' => 'Menunggu']);
        $b = $this->presensi(['NIM' => 'PNG2', 'Foto_wajah' => 'm2.jpg', 'Status_foto' => 'Menunggu']);
        $sudah = $this->presensi(['NIM' => 'PNG1', 'Sesi' => 'Lain', 'Foto_wajah' => 'm3.jpg', 'Status_foto' => 'Ditolak']);
        $gedungLain = $this->presensi(['NIM' => 'PNG3', 'Foto_wajah' => 'm4.jpg', 'Status_foto' => 'Menunggu']);

        $r = $this->postApi('presensi/validasi-foto-massal', ['ids' => [$a, $b, $sudah, $gedungLain, 999999]], $this->token('FAS1', 'fasil'));

        $r->assertStatus(200);
        $j = $this->json($r);
        $this->assertSame([2, 3], [$j['diterima'], $j['dilewati']]);
        $status = fn (int $id) => $this->db->table('presensi')->where('Id_presensi', $id)->get()->getRowArray();
        $this->assertSame('Diterima', $status($a)['Status_foto']);
        $this->assertSame('FAS1', $status($b)['Divalidasi_oleh']);
        $this->assertSame('Ditolak', $status($sudah)['Status_foto']);
        $this->assertSame('Menunggu', $status($gedungLain)['Status_foto']);
    }

    public function testTerimaSekaligusHanyaFasil(): void
    {
        $a = $this->presensi(['NIM' => 'PNG1', 'Foto_wajah' => 'm1.jpg', 'Status_foto' => 'Menunggu']);

        $this->postApi('presensi/validasi-foto-massal', ['ids' => [$a]], $this->token('ADM', 'admin'))->assertStatus(403);
        $this->postApi('presensi/validasi-foto-massal', ['ids' => [$a]], $this->token('PNG1', 'penghuni'))->assertStatus(403);
        $this->postApi('presensi/validasi-foto-massal', ['ids' => []], $this->token('FAS1', 'fasil'))->assertStatus(400);
        $this->assertSame('Menunggu', $this->barisPresensi('PNG1')['Status_foto']);
    }
}
