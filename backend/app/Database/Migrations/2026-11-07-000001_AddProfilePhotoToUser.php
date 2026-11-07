<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddProfilePhotoToUser extends Migration
{
    public function up()
    {
        $this->forge->addColumn('user', [
            'Foto_profil' => [
                'type' => 'TEXT',
                'null' => true,
                'after' => 'Password',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('user', 'Foto_profil');
    }
}