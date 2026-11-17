<?php

namespace App\Commands;

use App\Libraries\EventService;
use App\Libraries\LogAktivitas;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Throwable;

/**
 * Menandai peserta yang tidak presensi hingga event berakhir sebagai 'Tidak Hadir'.
 * Aman dijalankan berkala via cron:
 *
 *   * /15 * * * * cd /var/www/absensiasrama/backend && php spark event:auto-alpa >> writable/logs/event_alpa.log 2>&1
 */
class TandaiEventTidakHadir extends BaseCommand
{
    protected $group       = 'Event';
    protected $name        = 'event:auto-alpa';
    protected $description = 'Catat "Tidak Hadir" otomatis untuk penghuni yang tidak presensi pada event asrama yang sudah selesai.';
    protected $usage       = 'event:auto-alpa [--tanggal=YYYY-MM-DD] [--jam=HH:MM:SS]';
    protected $options     = [
        '--tanggal' => 'Tanggal patokan (default: hari ini).',
        '--jam'     => 'Jam patokan (default: saat ini).',
    ];

    public function run(array $params)
    {
        $tanggal = $this->opsi($params, 'tanggal') ?? date('Y-m-d');
        $jam     = $this->opsi($params, 'jam') ?? date('H:i:s');

        try {
            $service = new EventService();
            $hasil   = $service->tandaiTidakHadirEvent($tanggal, $jam);
        } catch (Throwable $e) {
            CLI::error('Gagal: ' . $e->getMessage());
            return EXIT_ERROR;
        }

        CLI::write('[' . date('Y-m-d H:i:s') . '] Pengecekan event selesai per ' . $tanggal . ' ' . $jam, 'green');
        CLI::write('Event diproses : ' . $hasil['eventDiproses']);
        CLI::write('Alpa dicatat   : ' . $hasil['alpaDibuat'], 'yellow');

        // Hanya dicatat bila benar-benar ada data dibuat (perintah ini dapat berjalan tiap menit)
        if ($hasil['alpaDibuat'] > 0) {
            LogAktivitas::sistem('event', 'Menandai Tidak Hadir event otomatis', sprintf('%d catatan dibuat dari %d event', $hasil['alpaDibuat'], $hasil['eventDiproses']));
        }

        return EXIT_SUCCESS;
    }

    private function opsi(array $params, string $nama): ?string
    {
        $opsi = CLI::getOptions() + $params;
        foreach ($opsi as $kunci => $nilai) {
            if (is_string($kunci) && str_starts_with($kunci, $nama . '=')) {
                return substr($kunci, strlen($nama . '='));
            }
        }
        if (array_key_exists($nama, $opsi)) {
            return is_string($opsi[$nama]) ? $opsi[$nama] : '';
        }
        return null;
    }
}
