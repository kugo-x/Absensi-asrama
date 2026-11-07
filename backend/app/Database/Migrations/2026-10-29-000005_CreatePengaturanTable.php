<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Pengaturan sistem berbentuk kunci-nilai (misal: mode uji absensi)
 */
class CreatePengaturanTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'Kunci' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
            ],
            'Nilai' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addKey('Kunci', true);
        $this->forge->createTable('pengaturan');
    }

    public function down()
    {
        $this->forge->dropTable('pengaturan');
    }
}
