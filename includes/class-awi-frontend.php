<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class AWI_Frontend {
	public static function init(): void {
		add_action( 'woocommerce_product_thumbnails', array( __CLASS__, 'render_product_video_in_gallery' ), 25 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_frontend_assets' ) );
	}

	public static function enqueue_frontend_assets(): void {
		if ( ! function_exists( 'is_product' ) || ! is_product() ) {
			return;
		}

		$product_id = get_the_ID();
		if ( ! $product_id ) {
			return;
		}

		$video_url = trim( (string) get_post_meta( $product_id, '_awi_video_url', true ) );
		if ( $video_url === '' ) {
			$video_url = trim( (string) get_post_meta( $product_id, '_product_video_url', true ) );
		}
		if ( $video_url === '' ) {
			return;
		}

		$poster_url = trim( (string) get_post_meta( $product_id, '_awi_video_poster', true ) );

		wp_register_style( 'awi-product-gallery', false, array(), AWI_VERSION ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion
		wp_enqueue_style( 'awi-product-gallery' );
		wp_add_inline_style( 'awi-product-gallery', self::get_gallery_css() );

		wp_enqueue_script(
			'awi-product-gallery',
			plugin_dir_url( AWI_PLUGIN_FILE ) . 'assets/product-gallery.js',
			array(),
			AWI_VERSION,
			true
		);

		wp_localize_script(
			'awi-product-gallery',
			'awiGalleryData',
			array(
				'video'  => esc_url_raw( $video_url ),
				'poster' => esc_url_raw( $poster_url ),
			)
		);
	}

	private static function get_gallery_css(): string {
		return '
.flex-control-thumbs li.awi-video-thumb { position: relative; }
.flex-control-thumbs li.awi-video-thumb::after {
	content: "\25B6";
	position: absolute;
	right: 6px;
	bottom: 6px;
	width: 18px;
	height: 18px;
	border-radius: 50%;
	background: rgba(0, 0, 0, 0.65);
	color: #fff;
	font-size: 11px;
	line-height: 18px;
	text-align: center;
	pointer-events: none;
}';
	}

	public static function render_product_video_in_gallery(): void {
		if ( ! function_exists( 'is_product' ) || ! is_product() ) {
			return;
		}

		$product_id = get_the_ID();
		if ( ! $product_id ) {
			return;
		}

		$video_url = trim( (string) get_post_meta( $product_id, '_awi_video_url', true ) );
		if ( $video_url === '' ) {
			$video_url = trim( (string) get_post_meta( $product_id, '_product_video_url', true ) );
		}
		if ( $video_url === '' ) {
			return;
		}

		$poster_url = trim( (string) get_post_meta( $product_id, '_awi_video_poster', true ) );
		$thumb_url  = $poster_url !== '' ? $poster_url : get_the_post_thumbnail_url( $product_id, 'woocommerce_thumbnail' );
		?>
		<div class="woocommerce-product-gallery__image awi-product-gallery-video awi-product-gallery-video-slide"<?php if ( $thumb_url !== '' ) : ?> data-thumb="<?php echo esc_url( $thumb_url ); ?>"<?php endif; ?> data-thumb-alt="Product video">
			<video controls playsinline preload="metadata"<?php if ( $poster_url !== '' ) : ?> poster="<?php echo esc_url( $poster_url ); ?>"<?php endif; ?> style="width:100%;height:auto;">
				<source src="<?php echo esc_url( $video_url ); ?>" type="video/mp4">
			</video>
		</div>
		<?php
	}
}
