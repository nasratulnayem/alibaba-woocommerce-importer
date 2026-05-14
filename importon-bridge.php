<?php
/**
 * Plugin Name: Importon Bridge
 * Description: Product sync for WooCommerce via browser extension and REST API.
 * Version: 0.1.0
 * Author: Nasratul Nayem
 * Author URI: https://github.com/nasratulnayem/importon-bridge
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Requires Plugins: woocommerce
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: importon-bridge
 *
 * Extension-first importer (no scraping UI in admin).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'AWI_VERSION', '0.1.0' );
define( 'AWI_PLUGIN_FILE', __FILE__ );
define( 'AWI_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

require_once AWI_PLUGIN_DIR . 'includes/class-awi-freemius.php';
register_uninstall_hook( AWI_PLUGIN_FILE, 'awi_uninstall_cleanup' );

require_once AWI_PLUGIN_DIR . 'includes/class-awi-admin.php';
require_once AWI_PLUGIN_DIR . 'includes/class-awi-rest.php';
require_once AWI_PLUGIN_DIR . 'includes/class-awi-frontend.php';
require_once AWI_PLUGIN_DIR . 'includes/class-awi-url-import.php';

final class AWI_Plugin {
	public static function init(): void {
		register_activation_hook( AWI_PLUGIN_FILE, array( __CLASS__, 'activate' ) );
		add_action( 'plugins_loaded', array( __CLASS__, 'plugins_loaded' ) );
	}

	public static function activate(): void {
		AWI_Rest::create_usage_table();
	}

	public static function plugins_loaded(): void {
		if ( ! class_exists( 'WooCommerce' ) ) {
			add_action( 'admin_notices', function () {
				echo '<div class="notice notice-error"><p>' . esc_html__( 'Importon Bridge requires WooCommerce to be installed and active.', 'importon-bridge' ) . '</p></div>';
			} );
			return;
		}

		if ( is_admin() ) {
			AWI_Admin::init();
			AWI_Url_Import::init();
		}

		AWI_Rest::init();
		AWI_Frontend::init();
	}
}

AWI_Plugin::init();

add_action( 'before_woocommerce_init', function () {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', AWI_PLUGIN_FILE, true );
	}
} );
