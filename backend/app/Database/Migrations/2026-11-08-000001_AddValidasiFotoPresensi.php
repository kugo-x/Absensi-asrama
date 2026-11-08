<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Validasi foto wajah presensi oleh fasil PJ gedung
 */
class AddValidasiFotoPresensi extends Migration
{
    public function up()
    {
        $this->forge->addColumn('presensi', [
            // NULL = baris tanpa foto (koreksi fasil / otomatis sistem)
            'Status_foto' => [
                'type'       => 'ENUM',
                'constraint' => ['Menunggu', 'Diterima', 'Ditolak'],
                'null'       => true,
                'default'    => 'Menunggu',
                'after'      => 'Foto_wajah',
            ],
            'Catatan_validasi' => [
                'type'  => 'TEXT',
                'null'  => true,
                'after' => 'Status_foto',
            ],
            'Divalidasi_oleh' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
                'after'      => 'Catatan_validasi',
            ],
            'Divalidasi_pada' => [
                'type'  => 'DATETIME',
                'null'  => true,
                'after' => 'Divalidasi_oleh',
            ],
        ]);
        $this->db->query('ALTER TABLE presensi ADD CONSTRAINT fk_presensi_divalidasi_oleh FOREIGN KEY (Divalidasi_oleh) REFERENCES user(NIM) ON DELETE SET NULL ON UPDATE CASCADE');
        $this->db->query('ALTER TABLE presensi ADD INDEX idx_presensi_status_foto (Status_foto)');

        // Data lama: tanpa foto -> NULL; foto yang sudah ada dianggap diterima agar tidak membanjiri antrean fasil
        $this->db->query("UPDATE presensi SET Status_foto = CASE WHEN Foto_wajah IS NULL OR Foto_wajah = '' THEN NULL ELSE 'Diterima' END");
    }

    public function down()
    {
        $this->db->query('ALTER TABLE presensi DROP FOREIGN KEY fk_presensi_divalidasi_oleh');
        $this->db->query('ALTER TABLE presensi DROP INDEX idx_presensi_status_foto');
        $this->forge->dropColumn('presensi', ['Status_foto', 'Catatan_validasi', 'Divalidasi_oleh', 'Divalidasi_pada']);
    }
}
