package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.modules.dto.CategoryDTO;
import com.handcraft.platform.modules.entity.Category;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.*;
import com.handcraft.platform.modules.vo.CategoryVO;
import java.util.*;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** 停用只改变新建选项，既有认证与历史仍引用原品类。 */
@Service
public class CategoryServiceImpl implements CategoryService {
    private final CategoryMapper categories;
    private final UserAccountMapper accounts;
    private final OperationLogService logs;
    public CategoryServiceImpl(CategoryMapper categories,UserAccountMapper accounts,OperationLogService logs){this.categories=categories;this.accounts=accounts;this.logs=logs;}
    public List<CategoryVO> list(Long userId,boolean admin){return BusinessLog.run(LoggerFactory.getLogger(getClass()),"品类查询",userId,()->{
        if(admin) requireAdmin(userId);
        List<Category> all=categories.all();
        return all.stream().filter(c->c.getParentId()==null&&(admin||c.isEnabled())).map(c->view(c,all.stream().filter(x->Objects.equals(x.getParentId(),c.getId())&&(admin||x.isEnabled())).map(x->view(x,List.of())).toList())).toList();
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public CategoryVO create(Long userId,CategoryDTO input){return BusinessLog.run(LoggerFactory.getLogger(getClass()),"品类创建",userId,()->{
        requireAdmin(userId);
        Long parent=parentId(input.getParentId());
        if(parent!=null){Category root=categories.share(parent);if(root==null||root.getParentId()!=null) throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"只能在一级品类下新增二级品类");}
        Category c=new Category();c.setParentId(parent);c.setName(input.getName());c.setEnabled(input.getEnabled());c.setSortOrder(input.getSortOrder());categories.insert(c);
        logs.record(userId,true,"CATEGORY",c.getId(),"CREATE",null,c.isEnabled()?"ENABLED":"DISABLED",null);return view(c,List.of());
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public CategoryVO update(Long userId,Long id,CategoryDTO input){return BusinessLog.run(LoggerFactory.getLogger(getClass()),"品类维护",userId,()->{
        requireAdmin(userId);Category c=categories.lock(id);if(c==null)throw new BusinessException(CommonErrorCode.NOT_FOUND);
        if(input.getParentId()!=null&&!Objects.equals(c.getParentId(),parentId(input.getParentId())))throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"品类创建后不能调整层级");
        String before=c.isEnabled()?"ENABLED":"DISABLED";c.setName(input.getName());c.setEnabled(input.getEnabled());c.setSortOrder(input.getSortOrder());categories.update(c);
        logs.record(userId,true,"CATEGORY",id,"UPDATE",before,c.isEnabled()?"ENABLED":"DISABLED",null);return view(c,List.of());
    });}
    private void requireAdmin(Long id){var user=accounts.findById(id);if(user==null||!user.isAdmin())throw new BusinessException(CommonErrorCode.FORBIDDEN);}
    private Long parentId(String value){if(value==null)return null;try{long id=Long.parseLong(value);if(id>0)return id;}catch(NumberFormatException ignored){}throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"父品类编号无效");}
    public static CategoryVO view(Category c,List<CategoryVO> children){return new CategoryVO(c.getId().toString(),c.getParentId()==null?null:c.getParentId().toString(),c.getName(),c.isEnabled(),c.getSortOrder(),children);}
}
