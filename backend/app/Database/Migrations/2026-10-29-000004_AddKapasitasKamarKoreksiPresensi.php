<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddKapasitasKamarKoreksiPresensi extends Migration
{
    public function up()
    {
        $this->forge->addColumn('kamar', [
            'Kapasitas' => [
                'type'       => 'INT',
                'constraint' => 11,
                'default'    => 2,
                'after'      => 'Lantai',
            ],
        ]);

        // NIM fasil yang mengoreksi presensi secara manual (null = presensi mandiri)
        $this->forge->addColumn('presensi', [
            'Dikoreksi_oleh' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
                'after'      => 'Keterangan',
            ],
        ]);
        $this->db->query('ALTER TABLE presensi ADD CONSTRAINT fk_presensi_dikoreksi_oleh FOREIGN KEY (Dikoreksi_oleh) REFERENCES user(NIM) ON DELETE SET NULL ON UPDATE CASCADE');

        // Satu penghuni hanya punya satu catatan per tanggal per sesi
        $this->db->query('ALTER TABLE presensi ADD UNIQUE KEY uq_presensi_nim_tanggal_sesi (NIM, Tanggal, Sesi)');
    }

    public function down()
    {
        $this->db->query('ALTER TABLE presensi DROP INDEX uq_presensi_nim_tanggal_sesi');
        $this->db->query('ALTER TABLE presensi DROP FOREIGN KEY fk_presensi_dikoreksi_oleh');
        $this->forge->dropColumn('presensi', 'Dikoreksi_oleh');
        $this->forge->dropColumn('kamar', 'Kapasitas');
    }
}
