<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function awi_uninstall_cleanup(): void {
	global $wpdb;

	$table = esc_sql( preg_replace( '/[^A-Za-z0-9_]/', '', $wpdb->prefix . 'awi_usage_log' ) );
	$wpdb->query( "DROP TABLE IF EXISTS `{$table}`" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

	delete_option( 'awi_ai_settings' );

	$wpdb->query(
		"DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_awi_pending_connect_%' OR option_name LIKE '_transient_timeout_awi_pending_connect_%'"
	); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

	$wpdb->delete( $wpdb->usermeta, array( 'meta_key' => '_awi_extension_settings_v1' ), array( '%s' ) );
	$wpdb->delete( $wpdb->usermeta, array( 'meta_key' => '_awi_rate_limit' ), array( '%s' ) );

	$uploads  = wp_upload_dir();
	$base_dir = trailingslashit( (string) $uploads['basedir'] ) . 'importon-bridge';
	if ( is_dir( $base_dir ) ) {
		awi_rmdir( $base_dir );
	}
}

function awi_rmdir( string $dir ): void {
	if ( ! is_dir( $dir ) ) {
		return;
	}
	require_once ABSPATH . 'wp-admin/includes/file.php';
	WP_Filesystem();
	global $wp_filesystem;
	$items = scandir( $dir );
	if ( ! is_array( $items ) ) {
		return;
	}
	foreach ( $items as $item ) {
		if ( $item === '.' || $item === '..' ) {
			continue;
		}
		$path = trailingslashit( $dir ) . $item;
		if ( is_dir( $path ) ) {
			awi_rmdir( $path );
		} else {
			wp_delete_file( $path );
		}
	}
	if ( isset( $wp_filesystem ) && is_object( $wp_filesystem ) ) {
		$wp_filesystem->rmdir( $dir, true );
	}
}
