<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateGedungTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'Id_Gedung' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'NIM_Pj' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
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
            'Radius_meter' => [
                'type'       => 'INT',
                'constraint' => 11,
                'default'    => 50,
            ],
            'Nama' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
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
        $this->forge->addKey('Id_Gedung', true);
        $this->forge->createTable('gedung');
    }

    public function down()
    {
        $this->forge->dropTable('gedung');
    }
}
