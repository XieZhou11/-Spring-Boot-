package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.CategoryDTO;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.CategoryService;
import com.handcraft.platform.modules.vo.CategoryVO;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** 品类资源，业务层再次校验管理员，前端入口不作为授权依据。 */
@RestController
public class CategoryController {
    private final CategoryService categories;
    public CategoryController(CategoryService categories){this.categories=categories;}
    @GetMapping("/api/categories") public Result<List<CategoryVO>> list(@AuthenticationPrincipal AccountPrincipal p){return Result.ok(categories.list(p.userId(),false));}
    @GetMapping("/api/admin/categories") public Result<List<CategoryVO>> admin(@AuthenticationPrincipal AccountPrincipal p){return Result.ok(categories.list(p.userId(),true));}
    @PostMapping("/api/admin/categories") @ResponseStatus(HttpStatus.CREATED)
    public Result<CategoryVO> create(@AuthenticationPrincipal AccountPrincipal p,@Valid @RequestBody CategoryDTO input){return Result.ok(categories.create(p.userId(),input));}
    @PutMapping("/api/admin/categories/{id}") public Result<CategoryVO> update(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody CategoryDTO input){return Result.ok(categories.update(p.userId(),id,input));}
}
