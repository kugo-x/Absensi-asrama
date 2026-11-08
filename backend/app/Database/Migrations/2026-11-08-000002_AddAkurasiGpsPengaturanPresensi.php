<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Akurasi GPS presensi + aturan presensi yang dapat diatur admin
 */
class AddAkurasiGpsPengaturanPresensi extends Migration
{
    // Kunci tabel pengaturan beserta nilai bawaannya
    private const DEFAULT = [
        'gps_akurasi_maks'  => '100', // meter; 0 = pemeriksaan akurasi dimatikan
        'batas_tidak_hadir' => '3',   // jumlah Tidak Hadir dalam 30 hari sebelum fasil diperingatkan
        'pengingat_menit'   => '15',  // banner pengingat muncul N menit sebelum sesi ditutup; 0 = mati
    ];

    public function up()
    {
        // Radius ketidakpastian lokasi yang dilaporkan perangkat (Geolocation API coords.accuracy)
        $this->forge->addColumn('presensi', [
            'Akurasi_meter' => [
                'type'       => 'DECIMAL',
                'constraint' => '8,2',
                'null'       => true,
                'after'      => 'Longitude',
            ],
        ]);

        $now = date('Y-m-d H:i:s');
        foreach (self::DEFAULT as $kunci => $nilai) {
            // INSERT IGNORE: jangan timpa nilai yang mungkin sudah diatur
            $this->db->table('pengaturan')->ignore(true)->insert(['Kunci' => $kunci, 'Nilai' => $nilai, 'updated_at' => $now]);
        }
    }

    public function down()
    {
        $this->forge->dropColumn('presensi', 'Akurasi_meter');
        $this->db->table('pengaturan')->whereIn('Kunci', array_keys(self::DEFAULT))->delete();
    }
}
