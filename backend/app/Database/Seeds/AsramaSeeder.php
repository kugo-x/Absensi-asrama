<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class AsramaSeeder extends Seeder
{
    public function run()
    {
        $db = \Config\Database::connect();
        $db->disableForeignKeyChecks();

        // Helper untuk memfilter kolom yang hanya ada di tabel target
        $filterData = static function (string $tableName, array $rows) use ($db): array {
            if (! $db->tableExists($tableName)) {
                return [];
            }
            $existingCols = $db->getFieldNames($tableName);
            $cleanRows = [];
            foreach ($rows as $row) {
                $cleanRow = [];
                foreach ($row as $col => $val) {
                    if (in_array($col, $existingCols, true)) {
                        $cleanRow[$col] = $val;
                    }
                }
                $cleanRows[] = $cleanRow;
            }
            return $cleanRows;
        };

        // 1. Clear existing records safely
        $tablesToTruncate = [
            'presensi_event', 'event', 'izin', 'hari_libur',
            'sesi_gedung_hari', 'sesi_gedung', 'sesi', 'presensi',
            'user', 'kamar', 'gedung'
        ];
        foreach ($tablesToTruncate as $t) {
            try {
                if ($db->tableExists($t)) {
                    $db->table($t)->truncate();
                }
            } catch (\Throwable $e) {}
        }

        // 2. Insert Gedung
        $gedungData = [
            [
                'Id_Gedung'    => 1,
                'Nama'         => 'Asrama Putra A',
                'NIM_Pj'       => '2310936001',
                'Latitude'     => -0.91448800,
                'Longitude'    => 100.46654200,
                'Radius_meter' => 50,
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'Id_Gedung'    => 2,
                'Nama'         => 'Asrama Putra B',
                'NIM_Pj'       => '2310936002',
                'Latitude'     => -0.91490000,
                'Longitude'    => 100.46700000,
                'Radius_meter' => 50,
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'Id_Gedung'    => 3,
                'Nama'         => 'Asrama Putri A',
                'NIM_Pj'       => '2310936003',
                'Latitude'     => -0.91350000,
                'Longitude'    => 100.46580000,
                'Radius_meter' => 50,
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'Id_Gedung'    => 4,
                'Nama'         => 'Asrama Putri B',
                'NIM_Pj'       => '2310936004',
                'Latitude'     => -0.91390000,
                'Longitude'    => 100.46610000,
                'Radius_meter' => 50,
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
        ];
        $filteredGedung = $filterData('gedung', $gedungData);
        if (! empty($filteredGedung)) {
            $db->table('gedung')->insertBatch($filteredGedung);
        }

        // 3. Insert Kamar
        $kamarData = [
            ['Nomor_kamar' => '001-PA',  'Lantai' => 1, 'Kapasitas' => 1, 'Id_Gedung' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '101-PA',  'Lantai' => 1, 'Kapasitas' => 2, 'Id_Gedung' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '102-PA',  'Lantai' => 1, 'Kapasitas' => 2, 'Id_Gedung' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '103-PA',  'Lantai' => 1, 'Kapasitas' => 2, 'Id_Gedung' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '201-PA',  'Lantai' => 2, 'Kapasitas' => 2, 'Id_Gedung' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '202-PA',  'Lantai' => 2, 'Kapasitas' => 2, 'Id_Gedung' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '101-PB',  'Lantai' => 1, 'Kapasitas' => 3, 'Id_Gedung' => 2, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '102-PB',  'Lantai' => 1, 'Kapasitas' => 2, 'Id_Gedung' => 2, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '001-PtA', 'Lantai' => 1, 'Kapasitas' => 1, 'Id_Gedung' => 3, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '101-PtA', 'Lantai' => 1, 'Kapasitas' => 3, 'Id_Gedung' => 3, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '102-PtA', 'Lantai' => 1, 'Kapasitas' => 2, 'Id_Gedung' => 3, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '201-PtA', 'Lantai' => 2, 'Kapasitas' => 2, 'Id_Gedung' => 3, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
        ];
        $filteredKamar = $filterData('kamar', $kamarData);
        if (! empty($filteredKamar)) {
            $db->table('kamar')->insertBatch($filteredKamar);
        }

        // 4. Insert Users
        $userData = [
            // Admin
            [
                'NIM'          => 'admin',
                'Nomor_kamar'  => null,
                'Asal'         => 'Padang',
                'Nama'         => 'Administrator Asrama',
                'No_HP'        => '081200000000',
                'Email'        => 'admin@unand.ac.id',
                'Password'     => password_hash('admin123', PASSWORD_BCRYPT),
                'Role'         => 'Admin',
                'Status_aktif' => 'Aktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            // Fasil
            [
                'NIM'          => '2310936001',
                'Nomor_kamar'  => '001-PA',
                'Asal'         => 'Padang',
                'Nama'         => 'Fitra Rahmad',
                'No_HP'        => '08111222333',
                'Email'        => 'fitra.rahmad@student.unand.ac.id',
                'Password'     => password_hash('fasil123', PASSWORD_BCRYPT),
                'Role'         => 'Fasil',
                'Status_aktif' => 'Aktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'NIM'          => '2310936002',
                'Nomor_kamar'  => '101-PB',
                'Asal'         => 'Bukittinggi',
                'Nama'         => 'Dimas Arjuna',
                'No_HP'        => '08111222334',
                'Email'        => 'dimas.arjuna@student.unand.ac.id',
                'Password'     => password_hash('fasil123', PASSWORD_BCRYPT),
                'Role'         => 'Fasil',
                'Status_aktif' => 'Aktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'NIM'          => '2310936003',
                'Nomor_kamar'  => '001-PtA',
                'Asal'         => 'Padang',
                'Nama'         => 'Sari Dewi Putri',
                'No_HP'        => '08333444555',
                'Email'        => 'sari.dewi@student.unand.ac.id',
                'Password'     => password_hash('fasil123', PASSWORD_BCRYPT),
                'Role'         => 'Fasil',
                'Status_aktif' => 'Aktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'NIM'          => '2310936004',
                'Nomor_kamar'  => '101-PtA',
                'Asal'         => 'Solok',
                'Nama'         => 'Nurul Hidayah',
                'No_HP'        => '08333444556',
                'Email'        => 'nurul.hidayah@student.unand.ac.id',
                'Password'     => password_hash('fasil123', PASSWORD_BCRYPT),
                'Role'         => 'Fasil',
                'Status_aktif' => 'Aktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            // Mahasiswa / Penghuni
            [
                'NIM'          => '2310933001',
                'Nomor_kamar'  => '101-PA',
                'Asal'         => 'Padang',
                'Nama'         => 'Ahmad Fauzi',
                'No_HP'        => '08123456789',
                'Email'        => 'ahmad.fauzi@student.unand.ac.id',
                'Password'     => password_hash('penghuni123', PASSWORD_BCRYPT),
                'Role'         => 'Mahasiswa',
                'Status_aktif' => 'Aktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'NIM'          => '2310933002',
                'Nomor_kamar'  => '101-PA',
                'Asal'         => 'Bukittinggi',
                'Nama'         => 'Budi Santoso',
                'No_HP'        => '08987654321',
                'Email'        => 'budi.santoso@student.unand.ac.id',
                'Password'     => password_hash('penghuni123', PASSWORD_BCRYPT),
                'Role'         => 'Mahasiswa',
                'Status_aktif' => 'Aktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'NIM'          => '2310933003',
                'Nomor_kamar'  => '102-PA',
                'Asal'         => 'Payakumbuh',
                'Nama'         => 'Rizky Pratama',
                'No_HP'        => '08567890123',
                'Email'        => 'rizky.pratama@student.unand.ac.id',
                'Password'     => password_hash('penghuni123', PASSWORD_BCRYPT),
                'Role'         => 'Mahasiswa',
                'Status_aktif' => 'Aktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'NIM'          => '2310933004',
                'Nomor_kamar'  => '201-PA',
                'Asal'         => 'Solok',
                'Nama'         => 'Dani Kurniawan',
                'No_HP'        => '08678901234',
                'Email'        => 'dani.kurniawan@student.unand.ac.id',
                'Password'     => password_hash('penghuni123', PASSWORD_BCRYPT),
                'Role'         => 'Mahasiswa',
                'Status_aktif' => 'Aktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'NIM'          => '2310933005',
                'Nomor_kamar'  => '101-PB',
                'Asal'         => 'Pariaman',
                'Nama'         => 'Eko Saputra',
                'No_HP'        => '08345678901',
                'Email'        => 'eko.saputra@student.unand.ac.id',
                'Password'     => password_hash('penghuni123', PASSWORD_BCRYPT),
                'Role'         => 'Mahasiswa',
                'Status_aktif' => 'Aktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'NIM'          => '2310933006',
                'Nomor_kamar'  => '101-PB',
                'Asal'         => 'Batam',
                'Nama'         => 'Fajar Nugroho',
                'No_HP'        => '08456789012',
                'Email'        => 'fajar.nugroho@student.unand.ac.id',
                'Password'     => password_hash('penghuni123', PASSWORD_BCRYPT),
                'Role'         => 'Mahasiswa',
                'Status_aktif' => 'Aktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'NIM'          => '2310933007',
                'Nomor_kamar'  => '101-PtA',
                'Asal'         => 'Padang Panjang',
                'Nama'         => 'Putri Rahayu',
                'No_HP'        => '08234567890',
                'Email'        => 'putri.rahayu@student.unand.ac.id',
                'Password'     => password_hash('penghuni123', PASSWORD_BCRYPT),
                'Role'         => 'Mahasiswa',
                'Status_aktif' => 'Aktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'NIM'          => '2310933008',
                'Nomor_kamar'  => '101-PtA',
                'Asal'         => 'Lintau',
                'Nama'         => 'Siti Aminah',
                'No_HP'        => '08111223344',
                'Email'        => 'siti.aminah@student.unand.ac.id',
                'Password'     => password_hash('penghuni123', PASSWORD_BCRYPT),
                'Role'         => 'Mahasiswa',
                'Status_aktif' => 'Nonaktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'NIM'          => '2310933009',
                'Nomor_kamar'  => '102-PtA',
                'Asal'         => 'Sijunjung',
                'Nama'         => 'Novia Rahmawati',
                'No_HP'        => '08765432109',
                'Email'        => 'novia.r@student.unand.ac.id',
                'Password'     => password_hash('penghuni123', PASSWORD_BCRYPT),
                'Role'         => 'Mahasiswa',
                'Status_aktif' => 'Aktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
            [
                'NIM'          => '2310933010',
                'Nomor_kamar'  => '201-PtA',
                'Asal'         => 'Dharmasraya',
                'Nama'         => 'Indah Permata',
                'No_HP'        => '08543219876',
                'Email'        => 'indah.p@student.unand.ac.id',
                'Password'     => password_hash('penghuni123', PASSWORD_BCRYPT),
                'Role'         => 'Mahasiswa',
                'Status_aktif' => 'Aktif',
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s'),
            ],
        ];
        $filteredUser = $filterData('user', $userData);
        if (! empty($filteredUser)) {
            $db->table('user')->insertBatch($filteredUser);
        }

        // 5. Insert Presensi
        $today = date('Y-m-d');
        $presensiData = [
            ['NIM' => '2310933001', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 05:12:00'), 'Latitude' => -0.91448800, 'Longitude' => 100.46654200, 'Status' => 'Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Hadir tepat waktu', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933002', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 05:30:00'), 'Latitude' => -0.91448800, 'Longitude' => 100.46654200, 'Status' => 'Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Hadir tepat waktu', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933005', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 04:55:00'), 'Latitude' => -0.91490000, 'Longitude' => 100.46700000, 'Status' => 'Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Hadir tepat waktu', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933006', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 05:40:00'), 'Latitude' => -0.91490000, 'Longitude' => 100.46700000, 'Status' => 'Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Hadir tepat waktu', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933007', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 05:20:00'), 'Latitude' => -0.91350000, 'Longitude' => 100.46580000, 'Status' => 'Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Hadir tepat waktu', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933009', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 05:10:00'), 'Latitude' => -0.91350000, 'Longitude' => 100.46580000, 'Status' => 'Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Hadir tepat waktu', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933010', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 05:25:00'), 'Latitude' => -0.91350000, 'Longitude' => 100.46580000, 'Status' => 'Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Hadir tepat waktu', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
        ];
        $filteredPresensi = $filterData('presensi', $presensiData);
        if (! empty($filteredPresensi)) {
            $db->table('presensi')->insertBatch($filteredPresensi);
        }

        // 6. Insert Izin
        $izinData = [
            [
                'NIM'                => '2310933003',
                'NIM_approver'       => null,
                'Alasan'             => 'Keluarga sakit, perlu pulang ke rumah untuk merawat ibu',
                'Status_persetujuan' => 'Pending',
                'File_bukti'         => 'surat_dokter.pdf',
                'Tanggal'            => date('Y-m-d', strtotime('+1 days')),
                'Tanggal_selesai'    => date('Y-m-d', strtotime('+3 days')),
                'Sesi'               => null,
                'Tanggal_approval'   => null,
                'Catatan_approver'   => null,
                'created_at'         => date('Y-m-d H:i:s'),
                'updated_at'         => date('Y-m-d H:i:s'),
            ],
            [
                'NIM'                => '2310933008',
                'NIM_approver'       => '2310936003',
                'Alasan'             => 'Wisuda kakak di Padang Panjang, diminta hadir oleh keluarga',
                'Status_persetujuan' => 'Disetujui',
                'File_bukti'         => 'undangan_wisuda.jpg',
                'Tanggal'            => date('Y-m-d', strtotime('-2 days')),
                'Tanggal_selesai'    => date('Y-m-d', strtotime('-1 days')),
                'Sesi'               => null,
                'Tanggal_approval'   => date('Y-m-d H:i:s', strtotime('-3 days')),
                'Catatan_approver'   => 'Disetujui, sampaikan selamat untuk kakaknya',
                'created_at'         => date('Y-m-d H:i:s', strtotime('-3 days')),
                'updated_at'         => date('Y-m-d H:i:s', strtotime('-2 days')),
            ],
            [
                'NIM'                => '2310933004',
                'NIM_approver'       => '2310936001',
                'Alasan'             => 'Pulang kampung mengunjungi orang tua',
                'Status_persetujuan' => 'Disetujui',
                'File_bukti'         => 'foto_tiket.jpg',
                'Tanggal'            => $today,
                'Tanggal_selesai'    => date('Y-m-d', strtotime('+1 days')),
                'Sesi'               => null,
                'Tanggal_approval'   => date('Y-m-d H:i:s', strtotime('-1 days')),
                'Catatan_approver'   => 'Hati-hati di jalan',
                'created_at'         => date('Y-m-d H:i:s', strtotime('-2 days')),
                'updated_at'         => date('Y-m-d H:i:s', strtotime('-1 days')),
            ],
            [
                'NIM'                => '2310933005',
                'NIM_approver'       => '2310936001',
                'Alasan'             => 'Sakit, perlu istirahat di rumah',
                'Status_persetujuan' => 'Ditolak',
                'File_bukti'         => '',
                'Tanggal'            => date('Y-m-d', strtotime('-4 days')),
                'Tanggal_selesai'    => null,
                'Sesi'               => null,
                'Tanggal_approval'   => date('Y-m-d H:i:s', strtotime('-4 days')),
                'Catatan_approver'   => 'Surat keterangan dokter tidak dilampirkan',
                'created_at'         => date('Y-m-d H:i:s', strtotime('-4 days')),
                'updated_at'         => date('Y-m-d H:i:s', strtotime('-4 days')),
            ],
        ];
        $filteredIzin = $filterData('izin', $izinData);
        if (! empty($filteredIzin)) {
            $db->table('izin')->insertBatch($filteredIzin);
        }

        // 7. Insert Sesi (jam presensi) jika tabel ada
        if ($db->tableExists('sesi')) {
            $sesiData = [
                ['Nama' => 'Subuh', 'Jam_mulai' => '04:00:00', 'Jam_selesai' => '06:00:00', 'Aktif' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ];
            $db->table('sesi')->insertBatch($filterData('sesi', $sesiData));
        }

        // Absen malam per gedung jika tabel ada
        if ($db->tableExists('sesi_gedung')) {
            $now = date('Y-m-d H:i:s');
            $sesiGedungData = [
                ['Id_Gedung' => 1, 'Nama' => 'Malam', 'Jam_mulai' => '18:00:00', 'Jam_selesai' => '20:30:00', 'Aktif' => 1, 'Diatur_oleh' => '2310936001', 'created_at' => $now, 'updated_at' => $now],
                ['Id_Gedung' => 2, 'Nama' => 'Malam', 'Jam_mulai' => '18:30:00', 'Jam_selesai' => '21:00:00', 'Aktif' => 1, 'Diatur_oleh' => '2310936002', 'created_at' => $now, 'updated_at' => $now],
                ['Id_Gedung' => 3, 'Nama' => 'Malam', 'Jam_mulai' => '19:00:00', 'Jam_selesai' => '21:30:00', 'Aktif' => 1, 'Diatur_oleh' => '2310936003', 'created_at' => $now, 'updated_at' => $now],
            ];
            $db->table('sesi_gedung')->insertBatch($filterData('sesi_gedung', $sesiGedungData));
        }

        // 8. Insert Hari Libur jika tabel ada
        if ($db->tableExists('hari_libur')) {
            $liburData = [
                [
                    'Tanggal_mulai'   => date('Y-m-d', strtotime('-10 days')),
                    'Tanggal_selesai' => date('Y-m-d', strtotime('-9 days')),
                    'Keterangan'      => 'Libur Maulid Nabi',
                    'created_at'      => date('Y-m-d H:i:s'),
                    'updated_at'      => date('Y-m-d H:i:s'),
                ]
            ];
            $filteredLibur = $filterData('hari_libur', $liburData);
            if (! empty($filteredLibur)) {
                $db->table('hari_libur')->insertBatch($filteredLibur);
            }
        }

        // 9. Insert Event Asrama & Presensi Event (Modul 2) jika tabel ada
        if ($db->tableExists('event')) {
            $eventData = [
                [
                    'id'           => 1,
                    'judul'        => 'Gotong Royong & Kerja Bakti Asrama',
                    'deskripsi'    => 'Kegiatan gotong royong membersihkan pekarangan dan selokan lingkungan asrama mahasiswa.',
                    'tipe'         => 'seluruh',
                    'id_gedung'    => null,
                    'tanggal'      => date('Y-m-d', strtotime('+2 days')),
                    'jam_mulai'    => '08:00:00',
                    'jam_selesai'  => '11:00:00',
                    'lokasi'       => 'Lapangan Depan Asrama Unand',
                    'latitude'     => -0.91448800,
                    'longitude'    => 100.46654200,
                    'radius_meter' => 80,
                    'created_by'   => 'admin',
                    'created_at'   => date('Y-m-d H:i:s'),
                    'updated_at'   => date('Y-m-d H:i:s'),
                ],
                [
                    'id'           => 2,
                    'judul'        => 'Briefing Disiplin Gedung Asrama Putra A',
                    'deskripsi'    => 'Pertemuan bulanan evaluasi ketertiban dan kebersihan khusus penghuni Gedung Asrama Putra A.',
                    'tipe'         => 'gedung',
                    'id_gedung'    => 1,
                    'tanggal'      => date('Y-m-d', strtotime('+3 days')),
                    'jam_mulai'    => '19:30:00',
                    'jam_selesai'  => '21:00:00',
                    'lokasi'       => 'Lobi Lantai 1 Gedung Asrama Putra A',
                    'latitude'     => -0.91448800,
                    'longitude'    => 100.46654200,
                    'radius_meter' => 50,
                    'created_by'   => '2310936001',
                    'created_at'   => date('Y-m-d H:i:s'),
                    'updated_at'   => date('Y-m-d H:i:s'),
                ],
            ];
            $filteredEvent = $filterData('event', $eventData);
            if (! empty($filteredEvent)) {
                $db->table('event')->insertBatch($filteredEvent);
            }
        }

        if ($db->tableExists('presensi_event')) {
            $presensiEvData = [
                [
                    'id_event'     => 1,
                    'nim'          => '2310933001',
                    'tanggal'      => date('Y-m-d', strtotime('+2 days')),
                    'waktu'        => '08:15:00',
                    'latitude'     => -0.91448800,
                    'longitude'    => 100.46654200,
                    'jarak_meter'  => 12.50,
                    'foto'         => null,
                    'status'       => 'Hadir',
                    'keterangan'   => 'Hadir tepat waktu',
                    'created_at'   => date('Y-m-d H:i:s'),
                    'updated_at'   => date('Y-m-d H:i:s'),
                ],
            ];
            $filteredPresensiEv = $filterData('presensi_event', $presensiEvData);
            if (! empty($filteredPresensiEv)) {
                $db->table('presensi_event')->insertBatch($filteredPresensiEv);
            }
        }

        $db->enableForeignKeyChecks();
    }
}
