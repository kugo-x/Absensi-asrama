<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddRentangSesiCatatanIzin extends Migration
{
    public function up()
    {
        $this->forge->addColumn('izin', [
            // Izin bisa berlaku beberapa hari; null = hanya pada kolom Tanggal
            'Tanggal_selesai' => [
                'type'  => 'DATE',
                'null'  => true,
                'after' => 'Tanggal',
            ],
            // Nama sesi yang diizinkan; null = seluruh sesi (seharian)
            'Sesi' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
                'after'      => 'Tanggal_selesai',
            ],
            // Catatan fasil saat menyetujui / alasan saat menolak
            'Catatan_approver' => [
                'type'  => 'TEXT',
                'null'  => true,
                'after' => 'Tanggal_approval',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('izin', ['Tanggal_selesai', 'Sesi', 'Catatan_approver']);
    }
}
