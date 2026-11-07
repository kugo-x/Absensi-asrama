<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateSesiTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'Id_sesi' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'Nama' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
            ],
            'Jam_mulai' => [
                'type' => 'TIME',
            ],
            'Jam_selesai' => [
                'type' => 'TIME',
            ],
            'Aktif' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'default'    => 1,
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
        $this->forge->addKey('Id_sesi', true);
        $this->forge->addUniqueKey('Nama');
        $this->forge->createTable('sesi');
    }

    public function down()
    {
        $this->forge->dropTable('sesi');
    }
}
