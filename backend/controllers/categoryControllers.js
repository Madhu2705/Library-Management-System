import { categoryValidationSchema } from "../services/validation-service.js";
import {
  ErrorHandlerService,
  paginationService,
} from "../services/index.js";
import CategoryModel from "../models/category-model.js";

class CategoryController {
  async createCategory(req, res, next) {
    const { error } = categoryValidationSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    try {
      /* CHECK CATEGORY NAME IS ALREADY EXIST */
      const isExist = await CategoryModel.findOne({ name: req.body.name });
      if (isExist) {
        return next(
          ErrorHandlerService.alreadyExist("Category Name is Already Exist")
        );
      }
      /* SAVE INTO DB */
      const document = await CategoryModel.create(req.body);
      return res.status(201).json(document);
    } catch (error) {
      next(error);
    }
  }

  async getCategories(req, res, next) {
    const { page, skip, limit } = paginationService(req);

    let totalPages;
    /* FILTER */
    const q = req.query.q;
    const filter = q ? { name: { $regex: new RegExp(q, "i") } } : {};
    try {
      const [categories, totalRecords] = await Promise.all([
        CategoryModel.find(filter, "-__v").skip(skip).limit(limit).exec(),
        CategoryModel.countDocuments(filter).exec(),
      ]);
      totalPages = Math.ceil(totalRecords / limit);
      return res
        .status(200)
        .json({ categories, page, limit, totalRecords, totalPages });
    } catch (error) {
      next(error);
    }
  }

  async getCategory(req, res, next) {
    const { _id } = req.params;
    try {
      const document = await CategoryModel.findById(_id, "-__v");
      if (!document) {
        return next(ErrorHandlerService.notFound("Category not found"));
      }
      return res.status(200).json({ category: document });
    } catch (error) {
      next(error);
    }
  }

  async updateCateogry(req, res, next) {
    const { _id } = req.params;
    try {
      /* VALIDATE REQEST */
      const { error } = categoryValidationSchema.validate(req.body);
      if (error) {
        return next(error);
      }
      const document = await CategoryModel.findByIdAndUpdate(_id, req.body, {
        new: true,
      });
      if (!document) {
        return next(ErrorHandlerService.notFound("Category not found"));
      }

      return res.status(200).json({ document });
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req, res, next) {
    const { _id } = req.params;
    try {
      const category = await CategoryModel.findByIdAndDelete(_id);
      if (!category) {
        return next(ErrorHandlerService.notFound("Category Not Found"));
      }
      res.status(204).json({ category });
    } catch (error) {
      next(error);
    }
  }

}

export default new CategoryController();
