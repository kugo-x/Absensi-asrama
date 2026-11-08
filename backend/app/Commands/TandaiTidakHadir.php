<?php

namespace App\Commands;

use App\Libraries\PresensiService;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Throwable;

/**
 * Menandai penghuni yang tidak presensi hingga sesi ditutup sebagai 'Tidak Hadir'
 * (atau 'Izin' bila punya izin disetujui). Aman dijalankan berulang, misal via cron tiap 15 menit:
 *
 *   * /15 * * * * cd /var/www/absensiasrama/backend && php spark presensi:tandai-alpa >> writable/logs/alpa.log 2>&1
 *
 * (hapus spasi antara "*" dan "/15"; ditulis begitu agar tidak menutup komentar PHP)
 */
class TandaiTidakHadir extends BaseCommand
{
    protected $group       = 'Presensi';
    protected $name        = 'presensi:tandai-alpa';
    protected $description = 'Catat "Tidak Hadir" untuk penghuni yang tidak presensi pada sesi yang sudah ditutup.';
    protected $usage       = 'presensi:tandai-alpa [--tanggal=YYYY-MM-DD]';
    protected $options     = [
        '--tanggal' => 'Tanggal yang diproses (default: hari ini). Untuk backfill/uji tanggal lampau.',
    ];

    public function run(array $params)
    {
        $tanggal = $this->opsiTanggal($params) ?? date('Y-m-d');
        $dt = is_string($tanggal) ? \DateTime::createFromFormat('!Y-m-d', $tanggal) : false;
        if (! $dt || $dt->format('Y-m-d') !== $tanggal) {
            CLI::error('Format --tanggal harus YYYY-MM-DD.');

            return EXIT_USER_INPUT;
        }

        try {
            $hasil = (new PresensiService())->tandaiTidakHadir($tanggal);
        } catch (Throwable $e) {
            CLI::error('Gagal: ' . $e->getMessage());

            return EXIT_ERROR;
        }

        CLI::write('[' . date('Y-m-d H:i:s') . '] Penandaan presensi tanggal ' . $hasil['tanggal'], 'green');

        if ($hasil['libur'] !== null) {
            CLI::write('Hari libur (' . $hasil['libur'] . '): tidak ada kewajiban presensi, dilewati.', 'yellow');
            CLI::write('Baris otomatis dihapus: ' . $hasil['dihapusLibur']);

            return EXIT_SUCCESS;
        }
        if ($hasil['sesi'] === []) {
            CLI::write('Tidak ada sesi aktif.', 'yellow');

            return EXIT_SUCCESS;
        }

        $rows = [];
        $total = 0;
        $diproses = 0;
        foreach ($hasil['sesi'] as $s) {
            $rows[] = [$s['sesi'], $s['status'], $s['tidakHadir'], $s['izin'], $s['diperbarui'], $s['sudahAda']];
            $total += $s['tidakHadir'] + $s['izin'];
            if ($s['status'] === 'diproses') {
                $diproses++;
            }
        }
        CLI::table($rows, ['Sesi', 'Status', 'Tidak Hadir', 'Izin', 'Diperbarui ke Izin', 'Sudah ada']);
        CLI::write(sprintf('Sesi diproses: %d, baris dibuat: %d', $diproses, $total), 'green');

        return EXIT_SUCCESS;
    }

    /**
     * Mendukung `--tanggal 2026-11-01` (sintaks bawaan CI4) maupun `--tanggal=2026-11-01`.
     * Mengembalikan string kosong bila opsi ada tetapi tanpa nilai (agar ditolak validasi).
     */
    private function opsiTanggal(array $params): ?string
    {
        $opsi = CLI::getOptions() + $params;
        foreach ($opsi as $kunci => $nilai) {
            if (is_string($kunci) && str_starts_with($kunci, 'tanggal=')) {
                return substr($kunci, strlen('tanggal='));
            }
        }
        if (array_key_exists('tanggal', $opsi)) {
            return is_string($opsi['tanggal']) ? $opsi['tanggal'] : '';
        }

        return null;
    }
}
