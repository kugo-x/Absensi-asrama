<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class AsramaSeeder extends Seeder
{
    public function run()
    {
        $db = \Config\Database::connect();
        $db->disableForeignKeyChecks();

        // 1. Clear existing records
        $db->table('izin')->truncate();
        $db->table('presensi')->truncate();
        $db->table('gedung')->truncate();
        $db->table('kamar')->truncate();
        $db->table('user')->truncate();

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
        $db->table('gedung')->insertBatch($gedungData);

        // 3. Insert Kamar
        $kamarData = [
            ['Nomor_kamar' => '001-PA',  'Lantai' => 1, 'Id_Gedung' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '101-PA',  'Lantai' => 1, 'Id_Gedung' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '102-PA',  'Lantai' => 1, 'Id_Gedung' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '103-PA',  'Lantai' => 1, 'Id_Gedung' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '201-PA',  'Lantai' => 2, 'Id_Gedung' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '202-PA',  'Lantai' => 2, 'Id_Gedung' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '101-PB',  'Lantai' => 1, 'Id_Gedung' => 2, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '102-PB',  'Lantai' => 1, 'Id_Gedung' => 2, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '001-PtA', 'Lantai' => 1, 'Id_Gedung' => 3, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '101-PtA', 'Lantai' => 1, 'Id_Gedung' => 3, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '102-PtA', 'Lantai' => 1, 'Id_Gedung' => 3, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['Nomor_kamar' => '201-PtA', 'Lantai' => 2, 'Id_Gedung' => 3, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
        ];
        $db->table('kamar')->insertBatch($kamarData);

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
        $db->table('user')->insertBatch($userData);

        // 5. Insert Presensi
        $today = date('Y-m-d');
        $presensiData = [
            ['NIM' => '2310933001', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 05:12:00'), 'Latitude' => -0.91448800, 'Longitude' => 100.46654200, 'Status' => 'Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Hadir tepat waktu', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933002', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 05:30:00'), 'Latitude' => -0.91448800, 'Longitude' => 100.46654200, 'Status' => 'Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Hadir tepat waktu', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933003', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 00:00:00'), 'Latitude' => null, 'Longitude' => null, 'Status' => 'Tidak Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Tanpa keterangan', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933004', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 00:00:00'), 'Latitude' => null, 'Longitude' => null, 'Status' => 'Izin', 'Foto_wajah' => null, 'Keterangan' => 'Pulang kampung', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933005', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 04:55:00'), 'Latitude' => -0.91490000, 'Longitude' => 100.46700000, 'Status' => 'Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Hadir tepat waktu', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933006', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 05:40:00'), 'Latitude' => -0.91490000, 'Longitude' => 100.46700000, 'Status' => 'Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Hadir tepat waktu', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933007', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 05:20:00'), 'Latitude' => -0.91350000, 'Longitude' => 100.46580000, 'Status' => 'Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Hadir tepat waktu', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933008', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 00:00:00'), 'Latitude' => null, 'Longitude' => null, 'Status' => 'Tidak Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Tanpa keterangan', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933009', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 05:10:00'), 'Latitude' => -0.91350000, 'Longitude' => 100.46580000, 'Status' => 'Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Hadir tepat waktu', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
            ['NIM' => '2310933010', 'Tanggal' => $today, 'Sesi' => 'Subuh', 'Waktu' => date('Y-m-d 05:25:00'), 'Latitude' => -0.91350000, 'Longitude' => 100.46580000, 'Status' => 'Hadir', 'Foto_wajah' => null, 'Keterangan' => 'Hadir tepat waktu', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')],
        ];
        $db->table('presensi')->insertBatch($presensiData);

        // 6. Insert Izin
        $izinData = [
            [
                'NIM'                => '2310933003',
                'NIM_approver'       => null,
                'Alasan'             => 'Keluarga sakit, perlu pulang ke rumah untuk merawat ibu',
                'Status_persetujuan' => 'Pending',
                'File_bukti'         => 'surat_dokter.pdf',
                'Tanggal'            => $today,
                'Tanggal_approval'   => null,
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
                'Tanggal_approval'   => date('Y-m-d H:i:s', strtotime('-3 days')),
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
                'Tanggal_approval'   => date('Y-m-d H:i:s', strtotime('-1 days')),
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
                'Tanggal_approval'   => date('Y-m-d H:i:s', strtotime('-4 days')),
                'created_at'         => date('Y-m-d H:i:s', strtotime('-4 days')),
                'updated_at'         => date('Y-m-d H:i:s', strtotime('-4 days')),
            ],
        ];
        $db->table('izin')->insertBatch($izinData);

        $db->enableForeignKeyChecks();
    }
}
