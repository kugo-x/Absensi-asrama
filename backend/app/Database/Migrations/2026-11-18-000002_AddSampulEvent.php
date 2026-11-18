<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Foto sampul event (opsional). Berkasnya disimpan di writable/uploads/event_sampul,
 * kolom ini hanya menyimpan nama berkas.
 */
class AddSampulEvent extends Migration
{
    public function up()
    {
        $this->forge->addColumn('event', [
            'foto_sampul' => ['type' => 'VARCHAR', 'constraint' => 120, 'null' => true, 'after' => 'radius_meter'],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('event', 'foto_sampul');
    }
}
