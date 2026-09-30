<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePresensiTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'Id_presensi' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'NIM' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
            ],
            'Tanggal' => [
                'type' => 'DATE',
            ],
            'Sesi' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
            ],
            'Waktu' => [
                'type' => 'DATETIME',
            ],
            'Latitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,8',
                'null'       => true,
            ],
            'Longitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '11,8',
                'null'       => true,
            ],
            'Status' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
            ],
            'Foto_wajah' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
            ],
            'Keterangan' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addKey('Id_presensi', true);
        $this->forge->addForeignKey('NIM', 'user', 'NIM', 'CASCADE', 'CASCADE');
        $this->forge->createTable('presensi');
    }

    public function down()
    {
        $this->forge->dropTable('presensi');
    }
}
