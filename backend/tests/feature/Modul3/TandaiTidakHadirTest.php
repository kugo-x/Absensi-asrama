<?php

namespace Tests\Feature\Modul3;

use App\Libraries\PresensiService;
use CodeIgniter\Test\StreamFilterTrait;
use InvalidArgumentException;

require_once __DIR__ . '/Modul3TestCase.php';

/**
 * Command presensi:tandai-alpa (logika di App\Libraries\PresensiService::tandaiTidakHadir)
 *
 * Tanggal uji tetap: Senin 2 Maret 2026; waktu "sekarang" diberikan eksplisit agar deterministik.
 * Sesi: Pagi 06:00–07:00 dan Malam 18:00–20:00. Penghuni wajib: PNG1, PNG2 (Gedung A), PNG3 (Gedung B).
 *
 * @internal
 */
final class TandaiTidakHadirTest extends Modul3TestCase
{
    // Menangkap keluaran CLI (CLI::write menulis ke STDOUT, bukan output buffer)
    use StreamFilterTrait;

    private const TGL = '2026-03-02';
    private PresensiService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->sesi('Pagi', '06:00:00', '07:00:00');
        $this->sesi('Malam', '18:00:00', '20:00:00');
        $this->svc = new PresensiService($this->db);
    }

    private function jalankan(string $sekarang = '2026-03-02 21:00:00'): array
    {
        return $this->svc->tandaiTidakHadir(self::TGL, $sekarang);
    }

    private function statusDi(string $nim, string $sesi): ?string
    {
        return $this->barisPresensi($nim, self::TGL, $sesi)['Status'] ?? null;
    }

    private function jumlah(): int
    {
        return $this->db->table('presensi')->where('Tanggal', self::TGL)->countAllResults();
    }

    public function testSebelumSesiSelesaiTidakMembuatBaris(): void
    {
        $hasil = $this->jalankan('2026-03-02 06:30:00');

        $this->assertSame(0, $this->jumlah());
        $this->assertStringStartsWith('belum ditutup', $hasil['sesi'][0]['status']);
        $this->assertStringStartsWith('belum ditutup', $hasil['sesi'][1]['status']);
    }

    public function testHanyaSesiYangSudahDitutup(): void
    {
        $this->jalankan('2026-03-02 12:00:00');

        $this->assertSame(3, $this->jumlah());
        $this->assertSame('Tidak Hadir', $this->statusDi('PNG1', 'Pagi'));
        $this->assertNull($this->statusDi('PNG1', 'Malam'));
    }

    public function testSesudahSesiSelesaiIsiBarisBenar(): void
    {
        $hasil = $this->jalankan();

        $this->assertSame(6, $this->jumlah(), '3 penghuni wajib x 2 sesi');
        $row = $this->barisPresensi('PNG1', self::TGL, 'Malam');
        $this->assertSame('Tidak Hadir', $row['Status']);
        $this->assertSame('2026-03-02 20:00:00', $row['Waktu'], 'Waktu = tanggal + Jam_selesai');
        $this->assertSame('Otomatis oleh sistem', $row['Keterangan']);
        $this->assertNull($row['Dikoreksi_oleh']);
        $this->assertNull($row['Status_foto']);
        $this->assertSame(3, $hasil['sesi'][0]['tidakHadir']);
    }

    public function testIdempotenDijalankanTigaKali(): void
    {
        $this->jalankan();
        $this->jalankan();
        $hasil = $this->jalankan();

        $this->assertSame(6, $this->jumlah());
        $this->assertSame(0, $hasil['sesi'][0]['tidakHadir'] + $hasil['sesi'][1]['tidakHadir']);
        $this->assertSame(3, $hasil['sesi'][0]['sudahAda']);
    }

    public function testMelewatiNonaktifFasilAdminTanpaKamar(): void
    {
        $this->jalankan();

        foreach (['NON1', 'TKM1', 'FAS1', 'FAS2', 'ADM'] as $nim) {
            $this->assertSame(0, $this->db->table('presensi')->where('NIM', $nim)->countAllResults(), $nim);
        }
    }

    public function testMelewatiSesiNonaktif(): void
    {
        $this->sesi('Siang', '12:00:00', '13:00:00', 0);
        $this->jalankan();

        $this->assertSame(0, $this->db->table('presensi')->where('Sesi', 'Siang')->countAllResults());
    }

    public function testHariLiburTidakMembuatBaris(): void
    {
        $this->libur('2026-03-01', '2026-03-03');
        $hasil = $this->jalankan();

        $this->assertSame(0, $this->jumlah());
        $this->assertSame('Libur uji', $hasil['libur']);
    }

    public function testIzinSatuHariSemuaSesi(): void
    {
        $this->izin('PNG1', self::TGL, null, null);
        $this->jalankan();

        $this->assertSame('Izin', $this->statusDi('PNG1', 'Pagi'));
        $this->assertSame('Izin', $this->statusDi('PNG1', 'Malam'));
        $this->assertStringStartsWith('Otomatis oleh sistem (izin #', $this->barisPresensi('PNG1', self::TGL, 'Pagi')['Keterangan']);
    }

    public function testIzinRentangTanggal(): void
    {
        $this->izin('PNG2', '2026-03-01', '2026-03-04', null);
        $this->jalankan();

        $this->assertSame('Izin', $this->statusDi('PNG2', 'Pagi'));
        $this->assertSame('Izin', $this->statusDi('PNG2', 'Malam'));
    }

    public function testIzinRentangYangSudahLewatTidakBerlaku(): void
    {
        $this->izin('PNG2', '2026-02-20', '2026-03-01', null);
        $this->jalankan();

        $this->assertSame('Tidak Hadir', $this->statusDi('PNG2', 'Pagi'));
    }

    public function testIzinPerSesi(): void
    {
        $this->izin('PNG3', self::TGL, null, 'Pagi');
        $this->jalankan();

        $this->assertSame('Izin', $this->statusDi('PNG3', 'Pagi'));
        $this->assertSame('Tidak Hadir', $this->statusDi('PNG3', 'Malam'));
    }

    public function testIzinPendingDanDitolakTetapTidakHadir(): void
    {
        $this->izin('PNG1', self::TGL, null, null, 'Pending');
        $this->izin('PNG2', self::TGL, null, null, 'Ditolak');
        $this->jalankan();

        $this->assertSame('Tidak Hadir', $this->statusDi('PNG1', 'Pagi'));
        $this->assertSame('Tidak Hadir', $this->statusDi('PNG2', 'Pagi'));
    }

    public function testTidakMenimpaHadirDanKoreksi(): void
    {
        $this->presensi(['NIM' => 'PNG1', 'Tanggal' => self::TGL, 'Sesi' => 'Pagi', 'Status' => 'Hadir', 'Keterangan' => 'Hadir via Web']);
        $this->presensi(['NIM' => 'PNG2', 'Tanggal' => self::TGL, 'Sesi' => 'Pagi', 'Status' => 'Izin', 'Keterangan' => 'Koreksi fasil', 'Dikoreksi_oleh' => 'FAS1']);
        $this->jalankan();

        $this->assertSame('Hadir', $this->statusDi('PNG1', 'Pagi'));
        $koreksi = $this->barisPresensi('PNG2', self::TGL, 'Pagi');
        $this->assertSame('Izin', $koreksi['Status']);
        $this->assertSame('Koreksi fasil', $koreksi['Keterangan']);
        $this->assertSame('FAS1', $koreksi['Dikoreksi_oleh']);
    }

    public function testIzinDisetujuiBelakanganMenaikkanBarisOtomatisJadiIzin(): void
    {
        $this->jalankan();
        $this->assertSame('Tidak Hadir', $this->statusDi('PNG1', 'Pagi'));

        $this->izin('PNG1', self::TGL, null, null);
        $hasil = $this->jalankan();

        $this->assertSame('Izin', $this->statusDi('PNG1', 'Pagi'));
        $this->assertSame(6, $this->jumlah());
        $this->assertSame(1, $hasil['sesi'][0]['diperbarui']);
    }

    public function testLiburDitetapkanBelakanganMenghapusHanyaBarisOtomatis(): void
    {
        $this->presensi(['NIM' => 'PNG1', 'Tanggal' => self::TGL, 'Sesi' => 'Malam', 'Status' => 'Hadir', 'Foto_wajah' => 'x.jpg', 'Keterangan' => 'Hadir via Web']);
        $this->jalankan();
        $this->libur(self::TGL, self::TGL);
        $this->jalankan();

        $this->assertSame(1, $this->jumlah(), 'hanya baris Hadir milik penghuni yang tersisa');
        $this->assertSame('Hadir', $this->statusDi('PNG1', 'Malam'));
    }

    public function testPenghuniYangMasukSetelahTanggalDilewati(): void
    {
        $this->db->table('user')->where('NIM', 'PNG3')->update(['created_at' => '2026-03-05 08:00:00']);
        $this->jalankan();

        $this->assertSame(0, $this->db->table('presensi')->where('NIM', 'PNG3')->countAllResults());
    }

    public function testSesiYangDibuatSetelahTanggalBelumBerlaku(): void
    {
        $this->sesi('Baru', '12:00:00', '13:00:00', 1, '2026-03-10 08:00:00');
        $hasil = $this->jalankan();

        $this->assertSame(0, $this->db->table('presensi')->where('Sesi', 'Baru')->countAllResults());
        $this->assertStringStartsWith('belum berlaku', $hasil['sesi'][1]['status']);
    }

    public function testTanggalMasaDepanDitolak(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->svc->tandaiTidakHadir('2026-03-03', '2026-03-02 21:00:00');
    }

    public function testCommandCliMencetakRingkasan(): void
    {
        $this->resetStreamFilterBuffer();
        command('presensi:tandai-alpa --tanggal ' . self::TGL);
        $keluaran = $this->getStreamFilterBuffer();

        $this->assertStringContainsString('Penandaan presensi tanggal 2026-03-02', $keluaran);
        $this->assertStringContainsString('Sesi diproses: 2, baris dibuat: 6', $keluaran);
        $this->assertSame(6, $this->jumlah());
    }
}
