<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Pengajuan ulang izin yang ditolak (kolom `izin.Id_izin_sebelumnya`).
 * Izin yang ditolak tidak diubah; pengajuan ulang adalah baris baru yang menunjuk ke izin lama itu,
 * sehingga riwayat penolakan beserta catatan fasil tetap tersimpan.
 */
class AddIzinSebelumnya extends Migration
{
    public function up()
    {
        $this->forge->addColumn('izin', [
            'Id_izin_sebelumnya' => ['type' => 'INT', 'constraint' => 11, 'unsigned' => true, 'null' => true, 'after' => 'Id_izin'],
        ]);
        $this->db->query('ALTER TABLE izin ADD CONSTRAINT fk_izin_sebelumnya FOREIGN KEY (Id_izin_sebelumnya) REFERENCES izin (Id_izin) ON DELETE SET NULL ON UPDATE CASCADE');
    }

    public function down()
    {
        $this->db->query('ALTER TABLE izin DROP FOREIGN KEY fk_izin_sebelumnya');
        $this->forge->dropColumn('izin', 'Id_izin_sebelumnya');
    }
}
