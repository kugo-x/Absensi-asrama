<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Log aktivitas: setiap perubahan data (siapa, apa, kapan) dicatat otomatis oleh filter CatatAktivitas.
 * Tanpa foreign key ke user agar catatan tetap ada walau akun pelakunya dihapus.
 */
class CreateLogAktivitasTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'Id_log'     => ['type' => 'BIGINT', 'constraint' => 20, 'unsigned' => true, 'auto_increment' => true],
            'Waktu'      => ['type' => 'DATETIME'],
            // NULL = dijalankan sistem (perintah terjadwal)
            'NIM'        => ['type' => 'VARCHAR', 'constraint' => 30, 'null' => true],
            'Peran'      => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
            'Entitas'    => ['type' => 'VARCHAR', 'constraint' => 30],
            'Aksi'       => ['type' => 'VARCHAR', 'constraint' => 120],
            'Rute'       => ['type' => 'VARCHAR', 'constraint' => 120, 'null' => true],
            'Target'     => ['type' => 'VARCHAR', 'constraint' => 120, 'null' => true],
            'Keterangan' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'Status'     => ['type' => 'VARCHAR', 'constraint' => 10, 'default' => 'berhasil'],
            'Kode_http'  => ['type' => 'SMALLINT', 'constraint' => 5, 'null' => true],
            // Ringkasan data yang dikirim (JSON, tanpa password/foto/berkas)
            'Data'       => ['type' => 'TEXT', 'null' => true],
            'Alamat_ip'  => ['type' => 'VARCHAR', 'constraint' => 45, 'null' => true],
            'Agen'       => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
        ]);
        $this->forge->addKey('Id_log', true);
        $this->forge->addKey('Waktu');
        $this->forge->addKey('NIM');
        $this->forge->addKey('Entitas');
        $this->forge->createTable('log_aktivitas');
    }

    public function down()
    {
        $this->forge->dropTable('log_aktivitas', true);
    }
}
