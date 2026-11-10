<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class ExpandProfilePhoto extends Migration
{
    public function up()
    {
        $this->forge->modifyColumn('user', [
            'Foto_profil' => [
                'type' => 'MEDIUMTEXT',
                'null' => true,
            ],
        ]);
    }

    public function down()
    {
        $this->forge->modifyColumn('user', [
            'Foto_profil' => [
                'type' => 'TEXT',
                'null' => true,
            ],
        ]);
    }
}
