<?php

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;

class EventService
{
    private BaseConnection $db;

    public function __construct(?BaseConnection $db = null)
    {
        $this->db = $db ?? Database::connect();
    }

    /**
     * Hitung jarak dua titik koordinat (meter) menggunakan rumus Haversine.
     */
    public function haversine(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371000; // meter
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $earthRadius * $c;
    }

    /**
     * Mencatat otomatis 'Tidak Hadir' untuk seluruh peserta yang belum presensi
     * pada event yang telah selesai.
     */
    public function tandaiTidakHadirEvent(?string $tanggal = null, ?string $jam = null): array
    {
        $tanggal = $tanggal ?? date('Y-m-d');
        $jam     = $jam ?? date('H:i:s');

        // Cari event yang sudah selesai:
        // tanggal < hari ini ATAU (tanggal == hari ini DAN jam_selesai < jam sekarang)
        $events = $this->db->query("
            SELECT e.*
            FROM event e
            WHERE (e.tanggal < ? OR (e.tanggal = ? AND e.jam_selesai <= ?))
            ORDER BY e.tanggal ASC, e.jam_selesai ASC
        ", [$tanggal, $tanggal, $jam])->getResultArray();

        $totalEventDiproses = 0;
        $totalAlpaDibuat = 0;

        foreach ($events as $ev) {
            if ($this->tanggalLibur($ev['tanggal'])) {
                continue;
            }
            $eventId = (int) $ev['id'];
            $tipe    = $ev['tipe'];
            $idGedung = $ev['id_gedung'] ? (int) $ev['id_gedung'] : null;

            // Ambil daftar penghuni aktif yang wajib hadir
            if ($tipe === 'gedung' && $idGedung !== null) {
                $peserta = $this->db->query("
                    SELECT u.NIM
                    FROM user u
                    JOIN kamar k ON BINARY k.Nomor_kamar = BINARY u.Nomor_kamar
                    WHERE k.Id_Gedung = ? AND LOWER(u.Role) IN ('mahasiswa', 'penghuni') AND u.Status_aktif = 'Aktif'
                ", [$idGedung])->getResultArray();
            } else {
                // Seluruh asrama
                $peserta = $this->db->query("
                    SELECT u.NIM
                    FROM user u
                    WHERE LOWER(u.Role) IN ('mahasiswa', 'penghuni') AND u.Status_aktif = 'Aktif'
                ")->getResultArray();
            }

            if (empty($peserta)) {
                continue;
            }

            $totalEventDiproses++;

            // Ambil NIM yang sudah memiliki catatan presensi
            $sudahAbsen = $this->db->query("
                SELECT nim FROM presensi_event WHERE id_event = ?
            ", [$eventId])->getResultArray();
            $nimSudahAbsen = array_column($sudahAbsen, 'nim');

            $now = date('Y-m-d H:i:s');
            foreach ($peserta as $p) {
                $nim = $p['NIM'];
                if (! in_array($nim, $nimSudahAbsen, true)) {
                    $this->db->table('presensi_event')->insert([
                        'id_event'    => $eventId,
                        'nim'         => $nim,
                        'tanggal'     => $ev['tanggal'],
                        'waktu'       => null,
                        'status'      => 'Tidak Hadir',
                        'keterangan'  => 'Tidak hadir hingga event berakhir',
                        'created_at'  => $now,
                        'updated_at'  => $now,
                    ]);
                    $totalAlpaDibuat++;
                    $nimSudahAbsen[] = $nim;
                }
            }
        }

        return [
            'status'             => 'success',
            'eventDiproses'      => $totalEventDiproses,
            'alpaDibuat'         => $totalAlpaDibuat,
            'tanggal'            => $tanggal,
            'jam'                => $jam,
        ];
    }

    /** Hari libur menonaktifkan seluruh absen, termasuk event */
    public function tanggalLibur(string $tanggal): ?array
    {
        if (! $this->db->tableExists('hari_libur')) {
            return null;
        }

        return $this->db->table('hari_libur')->where('Tanggal_mulai <=', $tanggal)->where('Tanggal_selesai >=', $tanggal)->get()->getRowArray();
    }

    /**
     * Foto absen event milik penghuni gedung yang dipegang fasil (untuk halaman Validasi Foto).
     * $nimFasil null = semua gedung (admin, hanya untuk dilihat/dihitung).
     */
    public function daftarFotoEvent(?string $nimFasil): array
    {
        $rows = $this->db->query("
            SELECT pe.id, pe.id_event AS idEvent, e.judul AS judulEvent, pe.nim, u.Nama AS namaPenghuni,
                   COALESCE(u.Nomor_kamar, '') AS nomorKamar, g.Nama AS namaGedung, pe.tanggal,
                   DATE_FORMAT(pe.waktu, '%H:%i') AS waktu, pe.latitude, pe.longitude, pe.jarak_meter AS jarakMeter,
                   pe.foto, pe.status, pe.Status_foto AS statusFoto, COALESCE(pe.Catatan_validasi, '') AS catatanValidasi,
                   pe.Divalidasi_oleh AS divalidasiOleh, v.Nama AS namaValidator,
                   COALESCE(DATE_FORMAT(pe.Divalidasi_pada, '%Y-%m-%d %H:%i'), '') AS divalidasiPada
            FROM presensi_event pe
            JOIN event e ON e.id = pe.id_event
            JOIN user u ON BINARY u.NIM = BINARY pe.nim
            JOIN kamar k ON BINARY k.Nomor_kamar = BINARY u.Nomor_kamar
            JOIN gedung g ON g.Id_Gedung = k.Id_Gedung
            LEFT JOIN user v ON BINARY v.NIM = BINARY pe.Divalidasi_oleh
            WHERE (? IS NULL OR g.NIM_Pj = ?) AND pe.foto IS NOT NULL AND pe.foto <> '' AND pe.Status_foto IS NOT NULL
            ORDER BY pe.tanggal DESC, pe.waktu DESC
        ", [$nimFasil, $nimFasil])->getResultArray();
        foreach ($rows as &$row) {
            $row['id']         = (int) $row['id'];
            $row['idEvent']    = (int) $row['idEvent'];
            $row['latitude']   = $row['latitude'] !== null ? (float) $row['latitude'] : null;
            $row['longitude']  = $row['longitude'] !== null ? (float) $row['longitude'] : null;
            $row['jarakMeter'] = $row['jarakMeter'] !== null ? (float) $row['jarakMeter'] : null;
        }

        return $rows;
    }

    /**
     * Mengambil daftar event sesuai dengan peran pengguna
     */
    public function ambilDaftarEvent(array $user): array
    {
        // Jalankan penandaan otomatis sebelum mengambil daftar
        $this->tandaiTidakHadirEvent();

        $role = strtolower($user['role'] ?? '');
        $nim  = $user['nim'] ?? '';

        $sql = "
            SELECT 
                e.id,
                e.judul,
                e.deskripsi,
                e.tipe,
                e.id_gedung as idGedung,
                g.Nama as namaGedung,
                e.tanggal,
                DATE_FORMAT(e.jam_mulai, '%H:%i') as jamMulai,
                DATE_FORMAT(e.jam_selesai, '%H:%i') as jamSelesai,
                e.lokasi,
                e.latitude,
                e.longitude,
                e.radius_meter as radiusMeter,
                e.foto_sampul as fotoSampul,
                e.created_by as createdBy,
                u.Nama as namaPembuat,
                DATE_FORMAT(e.created_at, '%Y-%m-%d %H:%i') as dibuatPada
            FROM event e
            LEFT JOIN gedung g ON g.Id_Gedung = e.id_gedung
            LEFT JOIN user u ON BINARY u.NIM = BINARY e.created_by
        ";

        if ($role === 'admin') {
            $sql .= " ORDER BY e.tanggal DESC, e.jam_mulai DESC";
            $events = $this->db->query($sql)->getResultArray();
        } elseif ($role === 'fasil') {
            // Fasil melihat event seluruh asrama + event gedung yang ia bina
            $sql .= "
                WHERE e.tipe = 'seluruh' OR e.id_gedung IN (
                    SELECT Id_Gedung FROM gedung WHERE NIM_Pj = ?
                )
                ORDER BY e.tanggal DESC, e.jam_mulai DESC
            ";
            $events = $this->db->query($sql, [$nim])->getResultArray();
        } else {
            // Penghuni melihat event seluruh asrama + event gedung tempat ia tinggal
            $gedungPenghuni = $this->db->query("
                SELECT k.Id_Gedung
                FROM user u
                JOIN kamar k ON BINARY k.Nomor_kamar = BINARY u.Nomor_kamar
                WHERE u.NIM = ?
                LIMIT 1
            ", [$nim])->getRowArray();
            $idGedung = $gedungPenghuni ? (int) $gedungPenghuni['Id_Gedung'] : 0;

            $sql .= "
                WHERE e.tipe = 'seluruh' OR e.id_gedung = ?
                ORDER BY e.tanggal DESC, e.jam_mulai DESC
            ";
            $events = $this->db->query($sql, [$idGedung])->getResultArray();
        }

        // Format tipe data dan sematkan status presensi untuk penghuni
        foreach ($events as &$ev) {
            $ev['id']          = (int) $ev['id'];
            $ev['idGedung']    = $ev['idGedung'] !== null ? (int) $ev['idGedung'] : null;
            $ev['latitude']    = $ev['latitude'] !== null ? (float) $ev['latitude'] : null;
            $ev['longitude']   = $ev['longitude'] !== null ? (float) $ev['longitude'] : null;
            $ev['radiusMeter'] = (int) $ev['radiusMeter'];

            if ($role === 'penghuni') {
                $pRecord = $this->db->query("
                    SELECT id, nim, tanggal, status, DATE_FORMAT(waktu, '%H:%i:%s') as waktu, jarak_meter as jarakMeter, foto, keterangan,
                           Status_foto as statusFoto, Catatan_validasi as catatanValidasi,
                           DATE_FORMAT(Divalidasi_pada, '%Y-%m-%d %H:%i:%s') as divalidasiPada
                    FROM presensi_event
                    WHERE id_event = ? AND nim = ?
                    LIMIT 1
                ", [$ev['id'], $nim])->getRowArray();

                if ($pRecord) {
                    $ev['statusKehadiran'] = $pRecord['status'];
                    $ev['presensiSaya']    = [
                        'id'         => (int) $pRecord['id'],
                        'idEvent'    => (int) $ev['id'],
                        'nim'        => $pRecord['nim'],
                        'tanggal'    => $pRecord['tanggal'],
                        'status'     => $pRecord['status'],
                        'waktu'      => $pRecord['waktu'],
                        'jarakMeter' => $pRecord['jarakMeter'] !== null ? (float) $pRecord['jarakMeter'] : null,
                        'foto'       => $pRecord['foto'],
                        'keterangan' => $pRecord['keterangan'],
                        'statusFoto' => $pRecord['statusFoto'],
                        'catatanValidasi' => $pRecord['catatanValidasi'],
                        'divalidasiPada'  => $pRecord['divalidasiPada'],
                    ];
                } else {
                    $ev['statusKehadiran'] = 'Belum Absen';
                    $ev['presensiSaya']    = null;
                }
            }
        }

        return $events;
    }

    /**
     * Mengambil rekap kehadiran untuk satu event tertentu
     */
    public function ambilRekapEvent(int $idEvent, array $user): ?array
    {
        $this->tandaiTidakHadirEvent();

        $ev = $this->db->query("
            SELECT 
                e.id,
                e.judul,
                e.deskripsi,
                e.tipe,
                e.id_gedung as idGedung,
                g.Nama as namaGedung,
                e.tanggal,
                DATE_FORMAT(e.jam_mulai, '%H:%i') as jamMulai,
                DATE_FORMAT(e.jam_selesai, '%H:%i') as jamSelesai,
                e.lokasi,
                e.latitude,
                e.longitude,
                e.radius_meter as radiusMeter,
                e.foto_sampul as fotoSampul,
                e.created_by as createdBy,
                u.Nama as namaPembuat
            FROM event e
            LEFT JOIN gedung g ON g.Id_Gedung = e.id_gedung
            LEFT JOIN user u ON BINARY u.NIM = BINARY e.created_by
            WHERE e.id = ?
        ", [$idEvent])->getRowArray();

        if (! $ev) {
            return null;
        }

        $role = strtolower($user['role'] ?? '');
        $nim  = $user['nim'] ?? '';

        // Hak akses: Admin boleh semua; Fasil hanya boleh seluruh asrama atau gedung yang dibinanya
        if ($role === 'fasil') {
            if ($ev['tipe'] === 'gedung' && $ev['idGedung']) {
                $pjGedung = $this->db->query("SELECT 1 FROM gedung WHERE Id_Gedung = ? AND NIM_Pj = ?", [$ev['idGedung'], $nim])->getRow();
                if (! $pjGedung) {
                    return null; // Tidak berhak
                }
            }
        }

        $ev['id']          = (int) $ev['id'];
        $ev['idGedung']    = $ev['idGedung'] !== null ? (int) $ev['idGedung'] : null;
        $ev['latitude']    = $ev['latitude'] !== null ? (float) $ev['latitude'] : null;
        $ev['longitude']   = $ev['longitude'] !== null ? (float) $ev['longitude'] : null;
        $ev['radiusMeter'] = (int) $ev['radiusMeter'];

        // Ambil daftar peserta wajib
        if ($ev['tipe'] === 'gedung' && $ev['idGedung'] !== null) {
            $pesertaQuery = $this->db->query("
                SELECT 
                    u.NIM as nim,
                    u.Nama as nama,
                    u.Nomor_kamar as nomorKamar,
                    g.Nama as namaGedung
                FROM user u
                JOIN kamar k ON BINARY k.Nomor_kamar = BINARY u.Nomor_kamar
                JOIN gedung g ON g.Id_Gedung = k.Id_Gedung
                WHERE k.Id_Gedung = ? AND LOWER(u.Role) IN ('mahasiswa', 'penghuni') AND u.Status_aktif = 'Aktif'
                ORDER BY u.Nomor_kamar ASC, u.Nama ASC
            ", [$ev['idGedung']]);
        } elseif ($role === 'fasil') {
            // Event seluruh asrama: fasil hanya melihat penghuni gedung yang dibinanya
            $pesertaQuery = $this->db->query("
                SELECT 
                    u.NIM as nim,
                    u.Nama as nama,
                    u.Nomor_kamar as nomorKamar,
                    g.Nama as namaGedung
                FROM user u
                JOIN kamar k ON BINARY k.Nomor_kamar = BINARY u.Nomor_kamar
                JOIN gedung g ON g.Id_Gedung = k.Id_Gedung
                WHERE g.NIM_Pj = ? AND LOWER(u.Role) IN ('mahasiswa', 'penghuni') AND u.Status_aktif = 'Aktif'
                ORDER BY g.Nama ASC, u.Nomor_kamar ASC, u.Nama ASC
            ", [$nim]);
        } else {
            $pesertaQuery = $this->db->query("
                SELECT 
                    u.NIM as nim,
                    u.Nama as nama,
                    COALESCE(u.Nomor_kamar, '-') as nomorKamar,
                    COALESCE(g.Nama, '-') as namaGedung
                FROM user u
                LEFT JOIN kamar k ON BINARY k.Nomor_kamar = BINARY u.Nomor_kamar
                LEFT JOIN gedung g ON g.Id_Gedung = k.Id_Gedung
                WHERE LOWER(u.Role) IN ('mahasiswa', 'penghuni') AND u.Status_aktif = 'Aktif'
                ORDER BY g.Nama ASC, u.Nomor_kamar ASC, u.Nama ASC
            ");
        }

        $pesertaList = $pesertaQuery->getResultArray();

        // Ambil data presensi yang tercatat untuk event ini
        $presensiList = $this->db->query("
            SELECT 
                nim,
                DATE_FORMAT(waktu, '%H:%i:%s') as waktu,
                jarak_meter as jarakMeter,
                foto,
                status,
                keterangan,
                Status_foto as statusFoto
            FROM presensi_event
            WHERE id_event = ?
        ", [$idEvent])->getResultArray();

        $mapPresensi = [];
        foreach ($presensiList as $pr) {
            $mapPresensi[$pr['nim']] = $pr;
        }

        $listRekap = [];
        $jmlHadir = 0;
        $jmlTidakHadir = 0;
        $jmlBelum = 0;

        foreach ($pesertaList as $p) {
            $pr = $mapPresensi[$p['nim']] ?? null;
            $status = $pr ? $pr['status'] : 'Belum Absen';

            if ($status === 'Hadir') {
                $jmlHadir++;
            } elseif ($status === 'Tidak Hadir') {
                $jmlTidakHadir++;
            } else {
                $jmlBelum++;
            }

            $listRekap[] = [
                'nim'        => $p['nim'],
                'nama'       => $p['nama'],
                'nomorKamar' => $p['nomorKamar'],
                'namaGedung' => $p['namaGedung'],
                'status'     => $status,
                'waktu'      => $pr['waktu'] ?? null,
                'jarakMeter' => isset($pr['jarakMeter']) && $pr['jarakMeter'] !== null ? (float) $pr['jarakMeter'] : null,
                'foto'       => $pr['foto'] ?? null,
                'keterangan' => $pr['keterangan'] ?? null,
                'statusFoto' => $pr['statusFoto'] ?? null,
            ];
        }

        $total = count($listRekap);
        $persen = $total > 0 ? round(($jmlHadir / $total) * 100) : 0;

        return [
            'event'     => $ev,
            'statistik' => [
                'totalPeserta' => $total,
                'hadir'        => $jmlHadir,
                'tidakHadir'   => $jmlTidakHadir,
                'belumAbsen'   => $jmlBelum,
                'persenHadir'  => $persen,
            ],
            'peserta'   => $listRekap,
        ];
    }
}
