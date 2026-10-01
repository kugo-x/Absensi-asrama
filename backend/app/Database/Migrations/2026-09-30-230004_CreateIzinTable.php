<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateIzinTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'Id_izin' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'NIM' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
            ],
            'NIM_approver' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
            ],
            'Alasan' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'Status_persetujuan' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'default'    => 'Pending',
            ],
            'File_bukti' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
            ],
            'Tanggal' => [
                'type' => 'DATE',
                'null' => true,
            ],
            'Tanggal_approval' => [
                'type' => 'DATETIME',
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
        $this->forge->addKey('Id_izin', true);
        $this->forge->addForeignKey('NIM', 'user', 'NIM', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('NIM_approver', 'user', 'NIM', 'SET NULL', 'CASCADE');
        $this->forge->createTable('izin');
    }

    public function down()
    {
        $this->forge->dropTable('izin');
    }
}
