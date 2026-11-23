<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Pengumuman dari admin (seluruh asrama / gedung tertentu) atau fasil (gedung binaannya) ke penghuni.
 */
class CreatePengumumanTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'             => ['type' => 'INT', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'judul'          => ['type' => 'VARCHAR', 'constraint' => 150],
            'isi'            => ['type' => 'TEXT'],
            'penting'        => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'tipe'           => ['type' => 'ENUM', 'constraint' => ['seluruh', 'gedung'], 'default' => 'seluruh'],
            'id_gedung'      => ['type' => 'INT', 'constraint' => 11, 'unsigned' => true, 'null' => true],
            // Kosong = tidak kedaluwarsa; lewat tanggal ini pengumuman tidak tampil ke penghuni
            'berlaku_sampai' => ['type' => 'DATE', 'null' => true],
            'created_by'     => ['type' => 'VARCHAR', 'constraint' => 30],
            'created_at'     => ['type' => 'DATETIME', 'null' => true],
            'updated_at'     => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['tipe', 'id_gedung']);
        $this->forge->addForeignKey('id_gedung', 'gedung', 'Id_Gedung', 'CASCADE', 'CASCADE', 'fk_pengumuman_gedung');
        $this->forge->createTable('pengumuman', true);
    }

    public function down()
    {
        $this->forge->dropTable('pengumuman', true);
    }
}
