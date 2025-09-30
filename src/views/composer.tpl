<div class="composer">
    <div class="composer-container">
        <nav class="navbar navbar-fixed-top mobile-navbar hidden-md hidden-lg">
            <div class="btn-group">
                <button class="btn btn-sm btn-primary composer-discard" data-action="discard" tabindex="-1"><i class="fa fa-times"></i></button>
                <button class="btn btn-sm btn-primary composer-submit" data-action="post" tabindex="-1"><i class="fa fa-chevron-right"></i></button>
            </div>
        </nav>
        <div class="row title-container">
            <div class="col-lg-12">
                <input class="title form-control" type="text" tabindex="1" placeholder="[[topic:composer.title-placeholder]]" />
            </div>
        </div>

        <div class="category-tag-row">
            <div class="btn-toolbar formatting-bar">
                <ul class="formatting-group">
                    <!-- Category selector -->
                </ul>
            </div>
        </div>

        <div class="row write-preview-container">
            <div class="write-container">
                <div class="help-text">
                    <span class="help hidden">[[modules:composer.compose]]</span>
                    <span class="toggle-preview hide">[[modules:composer.show-preview]]</span>
                </div>
                <textarea class="write" tabindex="4"></textarea>
            </div>
            <div class="hidden-sm hidden-xs preview-container">
                <div class="help-text">
                    <span class="toggle-preview">[[modules:composer.hide-preview]]</span>
                </div>
                <div class="preview well"></div>
            </div>
        </div>

        <div class="row footer">
            <div class="col-lg-12">
                <!-- IMPORT partials/compose-private-toggle.tpl -->
            </div>
        </div>
    </div>
</div>