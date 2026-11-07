<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateHariLiburTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'Id_libur' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'Tanggal_mulai' => [
                'type' => 'DATE',
            ],
            'Tanggal_selesai' => [
                'type' => 'DATE',
            ],
            'Keterangan' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
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
        $this->forge->addKey('Id_libur', true);
        $this->forge->createTable('hari_libur');
    }

    public function down()
    {
        $this->forge->dropTable('hari_libur');
    }
}
