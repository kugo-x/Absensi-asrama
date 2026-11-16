<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateEventTables extends Migration
{
    public function up()
    {
        // ----------------------------------------------------
        // Tabel event
        // ----------------------------------------------------
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'judul' => [
                'type'       => 'VARCHAR',
                'constraint' => 150,
            ],
            'deskripsi' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'tipe' => [
                'type'       => 'ENUM',
                'constraint' => ['seluruh', 'gedung'],
                'default'    => 'seluruh',
            ],
            'id_gedung' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
            ],
            'tanggal' => [
                'type' => 'DATE',
            ],
            'jam_mulai' => [
                'type' => 'TIME',
            ],
            'jam_selesai' => [
                'type' => 'TIME',
            ],
            'lokasi' => [
                'type'       => 'VARCHAR',
                'constraint' => 200,
            ],
            'latitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,8',
                'null'       => true,
            ],
            'longitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '11,8',
                'null'       => true,
            ],
            'radius_meter' => [
                'type'       => 'INT',
                'constraint' => 11,
                'default'    => 50,
            ],
            'created_by' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
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
        $this->forge->addKey('id', true);
        $this->forge->addForeignKey('id_gedung', 'gedung', 'Id_Gedung', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('created_by', 'user', 'NIM', 'SET NULL', 'CASCADE');
        $this->forge->createTable('event');

        // ----------------------------------------------------
        // Tabel presensi_event
        // ----------------------------------------------------
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'id_event' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'nim' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
            ],
            'tanggal' => [
                'type' => 'DATE',
            ],
            'waktu' => [
                'type' => 'TIME',
                'null' => true,
            ],
            'latitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,8',
                'null'       => true,
            ],
            'longitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '11,8',
                'null'       => true,
            ],
            'jarak_meter' => [
                'type' => 'FLOAT',
                'null' => true,
            ],
            'foto' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
            ],
            'status' => [
                'type'       => 'ENUM',
                'constraint' => ['Hadir', 'Tidak Hadir'],
                'default'    => 'Tidak Hadir',
            ],
            'keterangan' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
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
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['id_event', 'nim']);
        $this->forge->addForeignKey('id_event', 'event', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('nim', 'user', 'NIM', 'CASCADE', 'CASCADE');
        $this->forge->createTable('presensi_event');
    }

    public function down()
    {
        $this->forge->dropTable('presensi_event', true);
        $this->forge->dropTable('event', true);
    }
}
