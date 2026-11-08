<?php

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use InvalidArgumentException;
use RuntimeException;

/**
 * Aturan presensi yang dipakai bersama oleh controller API dan command CLI
 */
class PresensiService
{
    // Penanda baris yang dibuat command presensi:tandai-alpa (bukan absen mandiri / koreksi fasil)
    public const KETERANGAN_OTOMATIS = 'Otomatis oleh sistem';

    protected BaseConnection $db;

    public function __construct(?BaseConnection $db = null)
    {
        $this->db = $db ?? \Config\Database::connect();
    }

    public function cariLibur(string $tanggal): ?array
    {
        return $this->db->table('hari_libur')
            ->where('Tanggal_mulai <=', $tanggal)
            ->where('Tanggal_selesai >=', $tanggal)
            ->get()->getRowArray();
    }

    public function cariIzinDisetujui(string $nim, string $tanggal, string $sesi): ?array
    {
        return $this->db->table('izin')
            ->where('NIM', $nim)
            ->where('Status_persetujuan', 'Disetujui')
            ->where('Tanggal <=', $tanggal)
            ->where('COALESCE(Tanggal_selesai, Tanggal) >= ' . $this->db->escape($tanggal), null, false)
            ->groupStart()->where('Sesi', null)->orWhere('Sesi', $sesi)->groupEnd()
            ->get()->getRowArray();
    }

    /**
     * Seluruh izin disetujui yang mencakup $tanggal, dikelompokkan per NIM (satu query untuk semua penghuni)
     *
     * @return array<string, list<array>>
     */
    private function izinDisetujuiPadaTanggal(string $tanggal): array
    {
        $rows = $this->db->table('izin')
            ->select('Id_izin, NIM, Sesi')
            ->where('Status_persetujuan', 'Disetujui')
            ->where('Tanggal <=', $tanggal)
            ->where('COALESCE(Tanggal_selesai, Tanggal) >= ' . $this->db->escape($tanggal), null, false)
            ->get()->getResultArray();

        $perNim = [];
        foreach ($rows as $r) {
            $perNim[$r['NIM']][] = $r;
        }

        return $perNim;
    }

    /**
     * Kondisi SQL baris otomatis: dibuat command, belum pernah dikoreksi fasil, tanpa foto.
     * Hanya baris seperti ini yang boleh diubah/dihapus ulang oleh command.
     */
    private function kondisiOtomatis(string $alias = ''): string
    {
        $p = $alias !== '' ? $alias . '.' : '';

        return "{$p}Keterangan LIKE " . $this->db->escape(self::KETERANGAN_OTOMATIS . '%')
            . " AND {$p}Dikoreksi_oleh IS NULL AND ({$p}Foto_wajah IS NULL OR {$p}Foto_wajah = '')";
    }

    /**
     * Mencatat 'Tidak Hadir' (atau 'Izin') untuk penghuni yang tidak punya catatan presensi
     * pada setiap sesi aktif yang sudah ditutup pada $tanggal.
     *
     * Idempoten: memakai INSERT IGNORE di atas UNIQUE (NIM, Tanggal, Sesi), sehingga baris yang sudah
     * ada (absen mandiri, koreksi fasil, atau hasil run sebelumnya) tidak pernah ditimpa.
     *
     * Mode Uji sengaja TIDAK dibaca di sini: mode uji hanya melonggarkan validasi check-in agar admin
     * bisa mencoba fitur, bukan mengubah kewajiban presensi. Konsekuensinya, setelah command berjalan,
     * check-in di luar jam (abaikanJam) untuk sesi yang sudah ditandai akan ditolak "sudah tercatat".
     *
     * @param string      $tanggal  YYYY-MM-DD
     * @param string|null $sekarang 'Y-m-d H:i:s' (default: waktu server) — untuk pengujian
     *
     * @return array{tanggal: string, libur: ?string, dihapusLibur: int, sesi: list<array>}
     */
    public function tandaiTidakHadir(string $tanggal, ?string $sekarang = null): array
    {
        $sekarang ??= date('Y-m-d H:i:s');
        $hariIni = substr($sekarang, 0, 10);
        $jamSekarang = substr($sekarang, 11, 8);

        if ($tanggal > $hariIni) {
            throw new InvalidArgumentException('Tanggal ' . $tanggal . ' belum terjadi.');
        }

        $ringkasan = ['tanggal' => $tanggal, 'libur' => null, 'dihapusLibur' => 0, 'sesi' => []];

        // Hari libur: tidak ada kewajiban presensi. Baris otomatis yang telanjur dibuat sebelum
        // libur ditetapkan (libur ditambahkan belakangan) dihapus agar tidak tercatat Tidak Hadir.
        if ($libur = $this->cariLibur($tanggal)) {
            $ringkasan['libur'] = $libur['Keterangan'];
            $this->db->table('presensi')
                ->where('Tanggal', $tanggal)
                ->where($this->kondisiOtomatis(), null, false)
                ->delete();
            $ringkasan['dihapusLibur'] = $this->db->affectedRows();

            return $ringkasan;
        }

        // Hanya sesi yang aktif saat ini. Sesi yang dinonaktifkan di tengah hari tidak diproses,
        // konsisten dengan klien yang juga hanya menampilkan sesi aktif.
        $daftarSesi = $this->db->table('sesi')->where('Aktif', 1)->orderBy('Jam_mulai', 'ASC')->get()->getResultArray();

        // Penghuni wajib absen saat ini; yang baru masuk setelah $tanggal tidak ditandai (backfill aman)
        $penghuni = $this->db->table('user')
            ->select('NIM')
            ->where('Role', 'Mahasiswa')
            ->where('Status_aktif', 'Aktif')
            ->where('Nomor_kamar IS NOT NULL', null, false)
            ->where('Nomor_kamar !=', '')
            ->groupStart()->where('created_at', null)->orWhere('DATE(created_at) <= ' . $this->db->escape($tanggal), null, false)->groupEnd()
            ->get()->getResultArray();
        $nimList = array_column($penghuni, 'NIM');

        $izinPerNim = $this->izinDisetujuiPadaTanggal($tanggal);
        $now = date('Y-m-d H:i:s');

        $this->db->transStart();

        foreach ($daftarSesi as $s) {
            $info = [
                'sesi'         => $s['Nama'],
                'status'       => 'diproses',
                'tidakHadir'   => 0,
                'izin'         => 0,
                'diperbarui'   => 0,
                'sudahAda'     => 0,
            ];

            // Sesi yang baru dibuat setelah $tanggal belum menjadi kewajiban pada tanggal itu
            $berlakuSejak = $s['created_at'] !== null ? substr($s['created_at'], 0, 10) : null;
            if ($berlakuSejak !== null && $tanggal < $berlakuSejak) {
                $info['status'] = 'belum berlaku (sejak ' . $berlakuSejak . ')';
                $ringkasan['sesi'][] = $info;
                continue;
            }

            // Sesi hari ini yang belum ditutup: belum boleh ditandai (checkIn masih menerima s.d. Jam_selesai)
            if ($tanggal === $hariIni && $jamSekarang <= $s['Jam_selesai']) {
                $info['status'] = 'belum ditutup (' . substr($s['Jam_selesai'], 0, 5) . ')';
                $ringkasan['sesi'][] = $info;
                continue;
            }

            $ada = $this->db->table('presensi')
                ->select('Id_presensi, NIM, Status, (' . $this->kondisiOtomatis() . ') AS otomatis', false)
                ->where('Tanggal', $tanggal)
                ->where('Sesi', $s['Nama'])
                ->get()->getResultArray();
            $adaPerNim = array_column($ada, null, 'NIM');

            foreach ($nimList as $nim) {
                $izin = null;
                foreach ($izinPerNim[$nim] ?? [] as $i) {
                    if ($i['Sesi'] === null || $i['Sesi'] === $s['Nama']) {
                        $izin = $i;
                        break;
                    }
                }
                $status = $izin ? 'Izin' : 'Tidak Hadir';
                $keterangan = self::KETERANGAN_OTOMATIS . ($izin ? ' (izin #' . $izin['Id_izin'] . ')' : '');

                if (isset($adaPerNim[$nim])) {
                    $row = $adaPerNim[$nim];
                    // Izin yang disetujui setelah baris otomatis dibuat: naikkan Tidak Hadir -> Izin.
                    // Baris non-otomatis (absen mandiri / koreksi fasil) tidak pernah disentuh.
                    if ($izin && $row['otomatis'] && $row['Status'] === 'Tidak Hadir') {
                        $this->db->table('presensi')->where('Id_presensi', $row['Id_presensi'])->update([
                            'Status'     => 'Izin',
                            'Keterangan' => $keterangan,
                            'updated_at' => $now,
                        ]);
                        $info['diperbarui']++;
                    } else {
                        $info['sudahAda']++;
                    }
                    continue;
                }

                $this->db->table('presensi')->ignore(true)->insert([
                    'NIM'            => $nim,
                    'Tanggal'        => $tanggal,
                    'Sesi'           => $s['Nama'],
                    'Waktu'          => $tanggal . ' ' . $s['Jam_selesai'],
                    'Latitude'       => null,
                    'Longitude'      => null,
                    'Status'         => $status,
                    'Foto_wajah'     => null,
                    'Status_foto'    => null,
                    'Keterangan'     => $keterangan,
                    'Dikoreksi_oleh' => null,
                    'created_at'     => $now,
                    'updated_at'     => $now,
                ]);
                // 0 = bentrok UNIQUE (misal penghuni check-in tepat di sela query di atas)
                if ($this->db->affectedRows() > 0) {
                    $izin ? $info['izin']++ : $info['tidakHadir']++;
                } else {
                    $info['sudahAda']++;
                }
            }

            $ringkasan['sesi'][] = $info;
        }

        $this->db->transComplete();
        if (! $this->db->transStatus()) {
            throw new RuntimeException('Transaksi penandaan presensi gagal dan telah dibatalkan.');
        }

        return $ringkasan;
    }
}
