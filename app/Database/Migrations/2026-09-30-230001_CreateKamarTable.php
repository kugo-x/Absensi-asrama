<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateKamarTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'Nomor_kamar' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
            ],
            'Lantai' => [
                'type'       => 'INT',
                'constraint' => 11,
            ],
            'Id_Gedung' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
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
        $this->forge->addKey('Nomor_kamar', true);
        $this->forge->addForeignKey('Id_Gedung', 'gedung', 'Id_Gedung', 'CASCADE', 'CASCADE');
        $this->forge->createTable('kamar');
    }

    public function down()
    {
        $this->forge->dropTable('kamar');
    }
}
