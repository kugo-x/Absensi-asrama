<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Perbaikan: Status_foto bernilai bawaan 'Menunggu' membuat baris presensi TANPA foto
 * (koreksi fasil, data seeder, dsb.) ikut masuk antrean validasi foto.
 * Bawaan diubah menjadi NULL; checkIn() mengisi 'Menunggu' secara eksplisit untuk presensi berfoto.
 */
class StatusFotoBawaanNull extends Migration
{
    public function up()
    {
        $this->forge->modifyColumn('presensi', [
            'Status_foto' => [
                'type'       => 'ENUM',
                'constraint' => ['Menunggu', 'Diterima', 'Ditolak'],
                'null'       => true,
                'default'    => null,
            ],
        ]);

        // Baris tanpa foto tidak punya sesuatu untuk divalidasi
        $this->db->query("UPDATE presensi SET Status_foto = NULL WHERE Foto_wajah IS NULL OR Foto_wajah = ''");
    }

    public function down()
    {
        $this->forge->modifyColumn('presensi', [
            'Status_foto' => [
                'type'       => 'ENUM',
                'constraint' => ['Menunggu', 'Diterima', 'Ditolak'],
                'null'       => true,
                'default'    => 'Menunggu',
            ],
        ]);
    }
}
