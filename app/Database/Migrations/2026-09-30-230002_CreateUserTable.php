<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateUserTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'NIM' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
            ],
            'Nomor_kamar' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
            ],
            'Asal' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => true,
            ],
            'Nama' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
            ],
            'No_HP' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
            ],
            'Email' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => true,
            ],
            'Password' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
            ],
            'Role' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'default'    => 'Mahasiswa',
            ],
            'Status_aktif' => [
                'type'       => 'ENUM',
                'constraint' => ['Aktif', 'Nonaktif'],
                'default'    => 'Aktif',
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
        $this->forge->addKey('NIM', true);
        $this->forge->addForeignKey('Nomor_kamar', 'kamar', 'Nomor_kamar', 'SET NULL', 'CASCADE');
        $this->forge->createTable('user');

        // Tambahkan Foreign Key pada tabel gedung ke user(NIM)
        $this->db->query('ALTER TABLE gedung ADD CONSTRAINT fk_gedung_nim_pj FOREIGN KEY (NIM_Pj) REFERENCES user(NIM) ON DELETE SET NULL ON UPDATE CASCADE');
    }

    public function down()
    {
        $this->db->query('ALTER TABLE gedung DROP FOREIGN KEY fk_gedung_nim_pj');
        $this->forge->dropTable('user');
    }
}
