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
                'constraint' => 150,
            ],
            'latitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,8',
            ],
            'longitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '11,8',
            ],
            'radius_meter' => [
                'type'       => 'INT',
                'constraint' => 11,
                'default'    => 50,
            ],
            'created_by' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
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
        $this->forge->addKey('tanggal', false, false, 'idx_event_tanggal');
        $this->forge->addKey(['tipe', 'id_gedung'], false, false, 'idx_event_tipe_gedung');
        $this->forge->createTable('event', true);

        // Tambah Foreign Key secara aman tanpa menggagalkan migrasi jika terjadi ketidakcocokan collation
        try {
            $this->db->query('ALTER TABLE `event` ADD CONSTRAINT `fk_event_id_gedung` FOREIGN KEY (`id_gedung`) REFERENCES `gedung` (`Id_Gedung`) ON DELETE CASCADE ON UPDATE CASCADE');
        } catch (\Throwable $e) {}
        try {
            $this->db->query('ALTER TABLE `event` ADD CONSTRAINT `fk_event_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`NIM`) ON DELETE SET NULL ON UPDATE CASCADE');
        } catch (\Throwable $e) {}

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
                'type'       => 'DECIMAL',
                'constraint' => '8,2',
                'null'       => true,
            ],
            'foto' => [
                'type' => 'MEDIUMTEXT',
                'null' => true,
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
        $this->forge->addUniqueKey(['id_event', 'nim'], 'uk_event_nim');
        $this->forge->addKey('id_event', false, false, 'idx_presensi_event_id');
        $this->forge->addKey('nim', false, false, 'idx_presensi_event_nim');
        $this->forge->createTable('presensi_event', true);

        try {
            $this->db->query('ALTER TABLE `presensi_event` ADD CONSTRAINT `fk_pe_id_event` FOREIGN KEY (`id_event`) REFERENCES `event` (`id`) ON DELETE CASCADE ON UPDATE CASCADE');
        } catch (\Throwable $e) {}
        try {
            $this->db->query('ALTER TABLE `presensi_event` ADD CONSTRAINT `fk_pe_nim` FOREIGN KEY (`nim`) REFERENCES `user` (`NIM`) ON DELETE CASCADE ON UPDATE CASCADE');
        } catch (\Throwable $e) {}
    }

    public function down()
    {
        $this->forge->dropTable('presensi_event', true);
        $this->forge->dropTable('event', true);
    }
}
